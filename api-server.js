const http = require('http');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

function azureDevOpsHeaders() {
  const token = process.env.AZURE_DEVOPS_AUTH_TOKEN;
  if (!token || token.startsWith('replace-with-')) {
    throw new Error('Azure DevOps is not configured in .env.');
  }

  return {
    Accept: 'application/json',
    Authorization: `Basic ${Buffer.from(`:${token}`).toString('base64')}`,
    'Content-Type': 'application/json'
  };
}

function normalizeAssistantText(value) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const lines = value
      .map((entry) => normalizeAssistantText(entry))
      .filter((entry) => entry && entry.trim());
    return lines.join('\n');
  }

  if (value && typeof value === 'object') {
    if ('id' in value && ('title' in value || 'type' in value)) {
      const id = value.id ?? 'n/a';
      const type = value.type ?? 'Item';
      const title = value.title ?? 'Untitled item';
      const state = value.state ?? 'Unknown';
      const owner = value.assignedTo ?? value.assignee ?? value.owner ?? 'Unassigned';
      return `${id} • ${type} • ${title} • ${state} • ${owner}`;
    }

    const lines = Object.entries(value)
      .map(([key, entry]) => {
        const text = normalizeAssistantText(entry);
        return text ? `${key}: ${text}` : '';
      })
      .filter(Boolean);

    return lines.join('\n');
  }

  return String(value ?? '').trim();
}

function inferTableFromStructuredContent(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const records = value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry));
  if (records.length === 0) {
    return null;
  }

  const keys = Object.keys(records[0]);
  const hasLikelyRecordShape = keys.some((key) => ['id', 'title', 'type', 'state', 'assignee', 'assignedTo', 'name', 'owner'].includes(key));
  if (!hasLikelyRecordShape) {
    return null;
  }

  const columns = keys.map((key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()).trim());
  const rows = records.map((record) => keys.map((key) => {
    const cell = record[key];
    if (cell === null || cell === undefined) {
      return '';
    }
    if (typeof cell === 'object') {
      return normalizeAssistantText(cell);
    }
    return String(cell);
  }));

  return { columns, rows };
}

function isValidTable(table) {
  return (
    Array.isArray(table?.columns) &&
    table.columns.every((column) => typeof column === 'string') &&
    Array.isArray(table?.rows) &&
    table.rows.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'))
  );
}

function isValidChart(chart) {
  return (
    typeof chart?.title === 'string' &&
    Array.isArray(chart?.labels) &&
    chart.labels.length > 0 &&
    chart.labels.every((label) => typeof label === 'string') &&
    Array.isArray(chart?.values) &&
    chart.values.length === chart.labels.length &&
    chart.values.every((value) => typeof value === 'number' && Number.isFinite(value)) &&
    (chart.type === undefined || chart.type === 'bar' || chart.type === 'pie') &&
    (chart.unit === undefined || chart.unit === 'number' || chart.unit === 'currency' || chart.unit === 'percent')
  );
}

const PIE_CATEGORY_PATTERN = /lane|channel|category|area|team|owner|assignee/i;

// A two-column table of category/count pairs is chart-ready, so render it without a second model call.
function inferChartFromTable(table) {
  if (!isValidTable(table) || table.columns.length !== 2 || table.rows.length < 2 || table.rows.length > 12) {
    return null;
  }

  const [categoryColumn, valueColumn] = table.columns;
  if (!/count|total|items|tasks|number|volume/i.test(valueColumn)) {
    return null;
  }

  const values = table.rows.map((row) => Number(String(row[1]).replace(/[,\s]/g, '')));
  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return {
    title: `${valueColumn} by ${categoryColumn.toLowerCase()}`,
    labels: table.rows.map((row) => row[0]),
    values,
    unit: 'number',
    type: PIE_CATEGORY_PATTERN.test(categoryColumn) ? 'pie' : 'bar'
  };
}

// The model sometimes emits several JSON objects in one reply, so scan for each balanced object.
function extractJsonObjects(text) {
  const objects = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
    } else if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function parseAssistantResponse(content, source, actions) {
  const raw = typeof content === 'string' ? content.trim() : String(content ?? '').trim();
  const unfenced = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  const extras = actions?.length ? { actions } : {};
  const payloads = [];
  try {
    payloads.push(JSON.parse(unfenced));
  } catch {
    for (const candidate of extractJsonObjects(unfenced)) {
      try {
        payloads.push(JSON.parse(candidate));
      } catch {}
    }
  }

  const segments = [];
  let table;
  let chart;
  for (const payload of payloads) {
    const rawContent = payload?.content ?? payload;
    const normalized = normalizeAssistantText(rawContent);
    if (normalized && !segments.includes(normalized)) {
      segments.push(normalized);
    }

    if (!table) {
      const candidateTable = payload?.table ?? inferTableFromStructuredContent(rawContent);
      if (isValidTable(candidateTable)) {
        table = candidateTable;
      }
    }

    if (!chart && isValidChart(payload?.chart)) {
      chart = payload.chart;
    }
  }

  if (!chart) {
    chart = inferChartFromTable(table);
  }

  if (segments.length) {
    return { content: segments.join('\n\n'), source, ...(table ? { table } : {}), ...(chart ? { chart } : {}), ...extras };
  }

  return { content: normalizeAssistantText(raw) || raw, source, ...extras };
}

async function fetchCurrentSprintItems() {
  const orgUrl = process.env.AZURE_DEVOPS_ORG_URL?.replace(/\/$/, '');
  const project = process.env.AZURE_DEVOPS_DEFAULT_PROJECT;
  const team = process.env.AZURE_DEVOPS_TEAM || project;
  if (!orgUrl || !project || !team) {
    throw new Error('Azure DevOps organization, project, and team are required in .env.');
  }

  const projectPath = encodeURIComponent(project);
  const teamPath = encodeURIComponent(team);
  const iterationsUrl = `${orgUrl}/${projectPath}/${teamPath}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.1`;
  const iterationsResponse = await fetch(iterationsUrl, { headers: azureDevOpsHeaders() });
  if (!iterationsResponse.ok) {
    throw new Error(`Azure DevOps iteration lookup failed with status ${iterationsResponse.status}.`);
  }

  const iterations = await iterationsResponse.json();
  const currentIteration = iterations.value?.[0];
  if (!currentIteration?.path) {
    return { iteration: 'No current sprint', items: [] };
  }

  const wiqlUrl = `${orgUrl}/${projectPath}/_apis/wit/wiql?api-version=7.1`;
  const wiql = {
    query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project.replace(/'/g, "''")}' AND [System.IterationPath] = '${currentIteration.path.replace(/'/g, "''")}' ORDER BY [System.ChangedDate] DESC`
  };
  const wiqlResponse = await fetch(wiqlUrl, {
    method: 'POST',
    headers: azureDevOpsHeaders(),
    body: JSON.stringify(wiql)
  });
  if (!wiqlResponse.ok) {
    throw new Error(`Azure DevOps sprint query failed with status ${wiqlResponse.status}.`);
  }

  const queryResult = await wiqlResponse.json();
  const ids = (queryResult.workItems ?? []).slice(0, 50).map((item) => item.id);
  if (!ids.length) {
    return { iteration: currentIteration.path, items: [] };
  }

  const itemsUrl = `${orgUrl}/_apis/wit/workitems?ids=${ids.join(',')}&fields=System.Id,System.Title,System.State,System.AssignedTo,System.WorkItemType&api-version=7.1`;
  const itemsResponse = await fetch(itemsUrl, { headers: azureDevOpsHeaders() });
  if (!itemsResponse.ok) {
    throw new Error(`Azure DevOps work item lookup failed with status ${itemsResponse.status}.`);
  }

  const itemsResult = await itemsResponse.json();
  return {
    iteration: currentIteration.path,
    items: (itemsResult.value ?? []).map((item) => ({
      id: item.id,
      type: item.fields?.['System.WorkItemType'] ?? 'Work Item',
      title: item.fields?.['System.Title'] ?? 'Untitled',
      state: item.fields?.['System.State'] ?? 'Unknown',
      assignedTo: item.fields?.['System.AssignedTo']?.displayName ?? 'Unassigned'
    }))
  };
}

async function updateWorkItem({ id, state, description, comment, confirm }) {
  const orgUrl = process.env.AZURE_DEVOPS_ORG_URL?.replace(/\/$/, '');
  const project = process.env.AZURE_DEVOPS_DEFAULT_PROJECT;
  if (!orgUrl || !project) {
    throw new Error('Azure DevOps organization and project are required in .env.');
  }

  const workItemId = Number(id);
  if (!Number.isInteger(workItemId) || workItemId <= 0) {
    throw new Error('A valid numeric work item id is required.');
  }

  const operations = [];
  if (typeof state === 'string' && state.trim()) {
    operations.push({ op: 'add', path: '/fields/System.State', value: state.trim() });
  }
  if (typeof description === 'string' && description.trim()) {
    operations.push({ op: 'add', path: '/fields/System.Description', value: description.trim() });
  }
  // System.History appends a discussion comment on the work item.
  if (typeof comment === 'string' && comment.trim()) {
    operations.push({ op: 'add', path: '/fields/System.History', value: comment.trim() });
  }
  if (!operations.length) {
    throw new Error('Provide at least one of state, description, or comment to update.');
  }

  if (confirm !== true) {
    return {
      requiresConfirmation: true,
      applied: false,
      id: workItemId,
      proposedChanges: {
        state: state?.trim() || null,
        description: description?.trim() || null,
        comment: comment?.trim() || null
      },
      message:
        'Nothing was changed yet. Show the user this work item id and the exact proposed state, description, and comment, then ask them to confirm. Only call update_work_item again with confirm set to true after the user explicitly approves.'
    };
  }

  const updateUrl = `${orgUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/${workItemId}?api-version=7.1`;
  const updateResponse = await fetch(updateUrl, {
    method: 'PATCH',
    headers: { ...azureDevOpsHeaders(), 'Content-Type': 'application/json-patch+json' },
    body: JSON.stringify(operations)
  });

  if (!updateResponse.ok) {
    const errorBody = await updateResponse.text();
    let detail = errorBody;
    try {
      detail = JSON.parse(errorBody).message ?? errorBody;
    } catch {}
    throw new Error(`Azure DevOps work item update failed with status ${updateResponse.status}: ${detail}`);
  }

  const updated = await updateResponse.json();
  return {
    applied: true,
    id: updated.id ?? workItemId,
    type: updated.fields?.['System.WorkItemType'] ?? 'Work Item',
    title: updated.fields?.['System.Title'] ?? 'Untitled',
    state: updated.fields?.['System.State'] ?? 'Unknown',
    assignedTo: updated.fields?.['System.AssignedTo']?.displayName ?? 'Unassigned',
    applied: {
      state: state ?? null,
      description: description ? 'updated' : null,
      comment: comment ? 'added' : null
    }
  };
}

const assistantTools = [
  {
    type: 'function',
    function: {
      name: 'get_current_sprint',
      description: 'Gets live Azure DevOps work items for the configured team\'s current sprint, including ID, type, title, state, and assignee.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_work_item',
      description:
        'Updates an existing Azure DevOps work item: change its state/status, replace its description, and/or append a discussion comment. Requires the numeric work item id. Nothing is written unless confirm is true, so call it first without confirm to preview the change and ask the user to approve it.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'Numeric Azure DevOps work item id.' },
          state: { type: 'string', description: 'New work item state, for example New, Approved, Committed, Done, Active, Resolved, Closed.' },
          description: { type: 'string', description: 'Replacement text for the work item description field.' },
          comment: { type: 'string', description: 'Comment text to append to the work item discussion.' },
          confirm: {
            type: 'boolean',
            description: 'Set to true only after the user has explicitly approved the exact changes in this conversation. Leave false or omit to preview.'
          }
        },
        required: ['id'],
        additionalProperties: false
      }
    }
  }
];

const confirmationActions = ['Proceed updating', 'Let me edit the information again', 'Custom answer'];

async function runAssistantTool(name, rawArguments) {
  let args = {};
  if (typeof rawArguments === 'string' && rawArguments.trim()) {
    try {
      args = JSON.parse(rawArguments);
    } catch {
      throw new Error(`Tool ${name} was called with invalid JSON arguments.`);
    }
  }

  if (name === 'get_current_sprint') {
    return fetchCurrentSprintItems();
  }
  if (name === 'update_work_item') {
    return updateWorkItem(args);
  }
  throw new Error(`Unknown tool: ${name}`);
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant') && typeof entry.content === 'string' && entry.content.trim())
    .slice(-10)
    .map((entry) => ({ role: entry.role, content: entry.content.slice(0, 4000) }));
}

async function askAzureOpenAI(prompt, history) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '');
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
  if (!endpoint || !apiKey || !deployment || !apiVersion || apiKey.startsWith('replace-with-')) {
    throw new Error('Azure OpenAI is not configured in .env.');
  }

  const messages = [
    {
      role: 'system',
      content: 'You are the operations AI assistant for the Benefits Insights demo. Be concise, practical, and clearly state when you are making an assumption. Call get_current_sprint when the user needs live information about the current sprint, work-item state, ownership, delivery progress, backlog, blockers, or bugs. Call update_work_item when the user asks to change a work item status or state, set or rewrite its description, or add a comment or note to it; it needs the numeric work item id, so look the id up with get_current_sprint first when the user refers to an item by title. Never write a work item change without explicit user approval: call update_work_item without confirm first, then state the work item id, its current state, and the exact new state, description, and comment you intend to write, and ask the user to confirm. If any of those details are missing or ambiguous, ask the user for them instead of guessing. Only call update_work_item with confirm set to true after the user has clearly approved that specific change in this conversation. Do not call tools for general explanations, drafting, or questions that do not require current Azure DevOps data. When tool results are available, treat them as the source of truth and include item IDs, titles, states, and assignees when relevant. Always return a JSON object with a required content string and an optional table object. Add table with string columns and string-array rows whenever the user asks for a list, records, work items, backlog, bugs, or a comparison. Omit table for a conversational answer. Also add an optional chart object with title, labels (strings), values (numbers, same length as labels), unit "number", and type "bar" or "pie" whenever the answer is a breakdown or distribution across categories. Use type "bar" for counts by status, state, or severity, and type "pie" for share across sprint lanes, channels, teams, or owners. Omit chart when there is nothing to compare.'
    },
    ...sanitizeHistory(history),
    { role: 'user', content: prompt }
  ];

  const completionUrl = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  const requestCompletion = async (withTools) => {
    const completionResponse = await fetch(completionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        messages,
        ...(withTools ? { tools: assistantTools, tool_choice: 'auto' } : {}),
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 800
      })
    });

    if (!completionResponse.ok) {
      const errorBody = await completionResponse.text();
      let detail = errorBody;
      try {
        detail = JSON.parse(errorBody).error?.message ?? errorBody;
      } catch {}
      throw new Error(`Azure OpenAI request failed with status ${completionResponse.status}: ${detail}`);
    }

    const completionResult = await completionResponse.json();
    return completionResult.choices?.[0]?.message;
  };

  let assistantMessage = await requestCompletion(true);
  let usedAzureDevOps = false;
  let azureDevOpsFailed = false;
  let awaitingConfirmation = false;

  for (let round = 0; round < 3; round += 1) {
    const toolCalls = (assistantMessage?.tool_calls ?? []).filter((call) => call.function?.name);
    if (!toolCalls.length) {
      break;
    }

    messages.push(assistantMessage);
    for (const call of toolCalls) {
      usedAzureDevOps = true;
      let toolResult;
      try {
        toolResult = await runAssistantTool(call.function.name, call.function.arguments);
      } catch (error) {
        toolResult = { error: error.message };
        azureDevOpsFailed = true;
      }
      awaitingConfirmation = toolResult?.requiresConfirmation === true;
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(toolResult) });
    }

    assistantMessage = await requestCompletion(round < 2);
  }

  const content = assistantMessage?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Azure OpenAI returned an empty response.');
  }

  const actions = awaitingConfirmation ? confirmationActions : undefined;
  if (!usedAzureDevOps) {
    return parseAssistantResponse(content, 'Azure OpenAI', actions);
  }
  return parseAssistantResponse(content, azureDevOpsFailed ? 'Azure OpenAI (Azure DevOps unavailable)' : 'Azure OpenAI + Azure DevOps', actions);
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
    response.end();
    return;
  }

  if (request.method !== 'POST' || request.url !== '/api/assistant') {
    response.writeHead(404);
    response.end();
    return;
  }

  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', async () => {
    try {
      const payload = JSON.parse(body);
      const prompt = payload.prompt;
      if (typeof prompt !== 'string' || !prompt.trim()) {
        throw new Error('A non-empty prompt is required.');
      }
      const result = await askAzureOpenAI(prompt, payload.history);
      response.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      response.end(JSON.stringify({ error: error.message }));
    }
  });
});

if (require.main === module) {
  server.listen(3001, '127.0.0.1', () => {
    console.log('AI API listening on http://127.0.0.1:3001');
  });
}

module.exports = { parseAssistantResponse, updateWorkItem, assistantTools, sanitizeHistory, confirmationActions };

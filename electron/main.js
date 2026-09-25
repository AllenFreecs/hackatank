const { app, BrowserWindow, ipcMain } = require('electron');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const isDev = !app.isPackaged;

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

function microsoftGraphHeaders() {
  const token = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN;
  if (!token || token.startsWith('replace-with-')) {
    throw new Error('Microsoft Graph is not configured in .env.');
  }
  return { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function microsoftGraphCalendarPath() {
  const calendarId = process.env.MICROSOFT_GRAPH_CALENDAR_ID;
  const userId = process.env.MICROSOFT_GRAPH_USER_ID || 'me';
  if (userId === 'me' && !calendarId) return '/me/calendar';
  if (userId === 'me') return `/me/calendars/${encodeURIComponent(calendarId)}`;
  const owner = encodeURIComponent(userId);
  return calendarId ? `/users/${owner}/calendars/${encodeURIComponent(calendarId)}` : `/users/${owner}/calendar`;
}

function normalizeGraphEvent(event) {
  return {
    id: event.id,
    title: event.subject || '(No subject)',
    start: event.start?.dateTime,
    end: event.end?.dateTime,
    timeZone: event.start?.timeZone,
    location: event.location?.displayName || '',
    organizer: event.organizer?.emailAddress?.name || '',
    isOnlineMeeting: event.isOnlineMeeting === true,
    joinUrl: event.onlineMeeting?.joinUrl || event.onlineMeetingUrl || ''
  };
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token || token.startsWith('replace-with-')) {
    throw new Error('GitHub is not configured in .env.');
  }

  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

async function searchGitHub({ query, limit = 10 } = {}) {
  const searchQuery = typeof query === 'string' ? query.trim() : '';
  if (!searchQuery) {
    throw new Error('GitHub search query is required.');
  }

  const resultLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 25) : 10;
  const params = new URLSearchParams({ q: searchQuery, per_page: `${resultLimit}` });
  const response = await fetch(`https://api.github.com/search/issues?${params}`, { headers: githubHeaders() });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub search failed with status ${response.status}: ${errorBody}`);
  }

  const result = await response.json();
  return {
    totalCount: result.total_count || 0,
    items: (result.items || []).map((item) => ({
      number: item.number,
      title: item.title,
      state: item.state,
      type: item.pull_request ? 'Pull request' : 'Issue',
      repository: item.repository_url?.split('/').pop() || '',
      url: item.html_url,
      author: item.user?.login || 'unknown',
      updatedAt: item.updated_at
    }))
  };
}

function githubRepositoryPath(owner, repo) {
  if (!/^[\w.-]+$/.test(owner || '') || !/^[\w.-]+$/.test(repo || '') || owner.toLowerCase() === 'owner' || repo.toLowerCase() === 'repository') throw new Error('GitHub owner and repository are required.');
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

async function getGithubRepository({ owner, repo } = {}) {
  const response = await fetch(`https://api.github.com${githubRepositoryPath(owner, repo)}`, { headers: githubHeaders() });
  if (!response.ok) throw new Error(`GitHub repository lookup failed with status ${response.status}: ${await response.text()}`);
  const repository = await response.json();
  return { name: repository.full_name, description: repository.description || '', visibility: repository.visibility, defaultBranch: repository.default_branch, language: repository.language, stars: repository.stargazers_count, openIssues: repository.open_issues_count, url: repository.html_url, updatedAt: repository.updated_at };
}

async function getGithubFile({ owner, repo, path: filePath, branch } = {}) {
  if (!filePath || filePath.includes('..')) throw new Error('A valid GitHub file path is required.');
  const suffix = branch ? `?ref=${encodeURIComponent(branch)}` : '';
  const response = await fetch(`https://api.github.com${githubRepositoryPath(owner, repo)}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}${suffix}`, { headers: githubHeaders() });
  if (!response.ok) throw new Error(`GitHub file lookup failed with status ${response.status}: ${await response.text()}`);
  const file = await response.json();
  if (Array.isArray(file) || file.type !== 'file') throw new Error('The requested GitHub path is not a file.');
  return { path: file.path, sha: file.sha, branch: branch || null, content: Buffer.from(file.content || '', 'base64').toString('utf8'), url: file.html_url };
}

async function updateGithubFile({ owner, repo, path: filePath, content, message, branch, sha, confirm = false } = {}) {
  if (!filePath || filePath.includes('..') || typeof content !== 'string' || !message) throw new Error('GitHub owner, repository, file path, content, and commit message are required.');
  const proposedChanges = { owner, repo, path: filePath, branch: branch || null, content, message, sha: sha || null };
  if (confirm !== true) return { requiresConfirmation: true, applied: false, proposedChanges };
  if (!sha) throw new Error('The current file sha is required when confirming a GitHub code update.');
  const response = await fetch(`https://api.github.com${githubRepositoryPath(owner, repo)}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`, { method: 'PUT', headers: { ...githubHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ message, content: Buffer.from(content, 'utf8').toString('base64'), branch, sha }) });
  if (!response.ok) throw new Error(`GitHub code update failed with status ${response.status}: ${await response.text()}`);
  const result = await response.json();
  return { applied: true, path: filePath, commit: result.commit?.sha, url: result.commit?.html_url || result.content?.html_url };
}

async function fetchTeamsCalendar({ startDateTime, endDateTime }) {
  if (!startDateTime || !endDateTime) throw new Error('Calendar startDateTime and endDateTime are required.');
  const params = new URLSearchParams({ startDateTime, endDateTime, $orderby: 'start/dateTime', $top: '100' });
  const result = await fetch(`https://graph.microsoft.com/v1.0${microsoftGraphCalendarPath()}/calendarView?${params}`, { headers: microsoftGraphHeaders() });
  if (!result.ok) throw new Error(`Microsoft Graph calendar lookup failed with status ${result.status}.`);
  const payload = await result.json();
  return { events: (payload.value || []).map(normalizeGraphEvent), nextLink: payload['@odata.nextLink'] || null };
}

function microsoftGraphMailPath() {
  const userId = process.env.MICROSOFT_GRAPH_USER_ID || 'me';
  const folderId = process.env.MICROSOFT_GRAPH_MAIL_FOLDER_ID || 'inbox';
  return userId === 'me'
    ? `/me/mailFolders/${encodeURIComponent(folderId)}/messages`
    : `/users/${encodeURIComponent(userId)}/mailFolders/${encodeURIComponent(folderId)}/messages`;
}

function normalizeGraphMessage(message) {
  return {
    id: message.id,
    subject: message.subject || '(No subject)',
    sender: message.sender?.emailAddress?.name || message.sender?.emailAddress?.address || 'Unknown sender',
    senderAddress: message.sender?.emailAddress?.address || '',
    priority: message.importance === 'high' ? 'High' : message.importance === 'low' ? 'Low' : 'Normal',
    received: message.receivedDateTime,
    isRead: message.isRead === true,
    webUrl: message.webLink || ''
  };
}

async function fetchOutlookMessages({ unreadOnly = false, limit = 25 } = {}) {
  const resultLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 25;
  const params = new URLSearchParams({
    '$select': 'id,subject,sender,importance,receivedDateTime,isRead,webLink',
    '$orderby': 'receivedDateTime desc',
    '$top': `${resultLimit}`
  });
  if (unreadOnly === true) {
    params.set('$filter', 'isRead eq false');
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0${microsoftGraphMailPath()}?${params}`, {
    headers: microsoftGraphHeaders()
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Microsoft Graph Outlook mail lookup failed with status ${response.status}: ${errorBody}`);
  }

  const result = await response.json();
  return {
    messages: (result.value || []).map(normalizeGraphMessage),
    nextLink: result['@odata.nextLink'] || null
  };
}

async function createTeamsCalendarEvent({ title, start, end, timeZone, location, isOnlineMeeting, attendees }) {
  if (!title || !start || !end) throw new Error('Calendar title, start, and end are required.');
  const event = {
    subject: title,
    start: { dateTime: start, timeZone: timeZone || 'UTC' },
    end: { dateTime: end, timeZone: timeZone || 'UTC' },
    location: { displayName: location || '' },
    isOnlineMeeting: isOnlineMeeting === true,
    onlineMeetingProvider: isOnlineMeeting === true ? 'teamsForBusiness' : undefined,
    attendees: Array.isArray(attendees) ? attendees.filter((address) => typeof address === 'string' && address.includes('@')).map((address) => ({ emailAddress: { address: address.trim() }, type: 'required' })) : []
  };
  const result = await fetch(`https://graph.microsoft.com/v1.0${microsoftGraphCalendarPath()}/events`, { method: 'POST', headers: microsoftGraphHeaders(), body: JSON.stringify(event) });
  if (!result.ok) throw new Error(`Microsoft Graph calendar event creation failed with status ${result.status}.`);
  return normalizeGraphEvent(await result.json());
}

async function scheduleTeamsCalendarEvent(args) {
  const { confirm, ...event } = args;
  if (confirm !== true) return { requiresConfirmation: true, applied: false, proposedEvent: event, message: 'Nothing was created yet. Show the exact event details and ask the user to confirm before calling again with confirm true.' };
  return createTeamsCalendarEvent(event);
}

function normalizeSharePointSearchBaseUrl(value) {
  const parsed = new URL(value);
  const layoutIndex = parsed.pathname.toLowerCase().indexOf('/_layouts/');
  if (layoutIndex >= 0) {
    parsed.pathname = parsed.pathname.slice(0, layoutIndex);
  } else {
    const documentLibraryIndex = parsed.pathname.search(/\/(?:documents|shared%20documents|shared documents)(?:\/|$)/i);
    if (documentLibraryIndex >= 0) {
      parsed.pathname = parsed.pathname.slice(0, documentLibraryIndex);
    }
  }

  parsed.search = '';
  parsed.hash = '';
  parsed.pathname = parsed.pathname.replace(/\/$/, '');
  return parsed.toString().replace(/\/$/, '');
}

function sharePointSearchUrl() {
  const configuredUrl = process.env.SHAREPOINT_SEARCH_URL || process.env.SHAREPOINT_SITE_URL;
  if (!configuredUrl) {
    throw new Error('SharePoint search URL or site URL is required in .env.');
  }

  return normalizeSharePointSearchBaseUrl(configuredUrl);
}

function sharePointBrowserSearchUrl(query) {
  const searchBaseUrl = sharePointSearchUrl();
  const params = new URLSearchParams({ q: query });
  return `${searchBaseUrl}/_layouts/15/search.aspx/files?${params.toString()}`;
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

function normalizeChart(chart) {
  if (!chart || typeof chart.title !== 'string' || !Array.isArray(chart.labels) || chart.labels.length === 0 || !chart.labels.every((label) => typeof label === 'string')) {
    return null;
  }

  if (!Array.isArray(chart.values) || chart.values.length !== chart.labels.length) {
    return null;
  }

  const normalizedValues = chart.values.map((value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
    return null;
  });

  if (normalizedValues.some((value) => value === null)) {
    return null;
  }

  if (chart.type !== undefined && chart.type !== 'bar' && chart.type !== 'pie') {
    return null;
  }

  if (chart.unit !== undefined && chart.unit !== 'number' && chart.unit !== 'currency' && chart.unit !== 'percent') {
    return null;
  }

  return {
    title: chart.title,
    labels: chart.labels,
    values: normalizedValues,
    ...(chart.type ? { type: chart.type } : {}),
    ...(chart.unit ? { unit: chart.unit } : {})
  };
}

function isValidChart(chart) {
  return normalizeChart(chart) !== null;
}

function inferChartFromText(value) {
  const text = normalizeAssistantText(value);
  if (!text) {
    return null;
  }

  const tableRows = [...text.matchAll(/^\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gm)]
    .map((match) => [match[1].trim(), match[2].trim()])
    .filter((row) => !/^:?-{3,}:?$/.test(row[0]) && !/^:?-{3,}:?$/.test(row[1]));
  if (tableRows.length >= 3 && /count|total|items|tasks|number|volume/i.test(tableRows[0][1])) {
    const points = tableRows.slice(1)
      .map(([label, value]) => ({ label, value: Number(value.replace(/,/g, '')) }))
      .filter((point) => point.label && Number.isFinite(point.value));
    if (points.length >= 2) {
      return {
        title: `${tableRows[0][1]} by ${tableRows[0][0].toLowerCase()}`,
        labels: points.map((point) => point.label),
        values: points.map((point) => point.value),
        unit: 'number',
        type: 'bar'
      };
    }
  }

  const points = [...text.matchAll(/(?:^|\n)\s*[-*]\s*([^:\n]+):\s*([\d,]+)(?:\s+\w+)?\s*$/gm)]
    .map((match) => ({ label: match[1].trim(), value: Number(match[2].replace(/,/g, '')) }))
    .filter((point) => point.label && Number.isFinite(point.value));

  if (points.length < 2) {
    return null;
  }

  return {
    title: 'Status summary',
    labels: points.map((point) => point.label),
    values: points.map((point) => point.value),
    unit: 'number',
    type: 'bar'
  };
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

function extractPartialContent(text) {
  const match = /"content"\s*:\s*"((?:\\.|[^"\\])*)/.exec(text);
  if (!match) {
    return '';
  }

  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
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

    if (!chart) {
      const candidateChart = normalizeChart(payload?.chart);
      if (candidateChart) {
        chart = candidateChart;
      }
    }
  }

  if (!chart) {
    chart = inferChartFromTable(table);
  }

  if (!chart) {
    for (const payload of payloads) {
      chart = inferChartFromText(payload?.content ?? payload);
      if (chart) {
        break;
      }
    }
  }

  if (segments.length) {
    return { content: segments.join('\n\n'), source, ...(table ? { table } : {}), ...(chart ? { chart } : {}), ...extras };
  }

  const partialContent = extractPartialContent(unfenced);
  return { content: partialContent || normalizeAssistantText(raw) || raw, source, ...extras };
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

function formatSharePointFileType(mimeType, name) {
  const mime = (mimeType || '').toLowerCase();
  const filename = (name || '').toLowerCase();
  if (mime.includes('presentation') || filename.endsWith('.pptx') || filename.endsWith('.ppt')) return 'PowerPoint';
  if (mime.includes('wordprocessing') || filename.endsWith('.docx') || filename.endsWith('.doc')) return 'Word';
  if (mime.includes('spreadsheet') || mime.includes('excel') || filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.csv')) return 'Excel';
  if (mime.includes('pdf') || filename.endsWith('.pdf')) return 'PDF';
  if (mime.includes('image') || filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'Image';
  if (mime.includes('folder')) return 'Folder';
  return 'Document';
}

async function searchSharePointFiles({ query, limit }) {
  const isWildcard = !query || typeof query !== 'string' || !query.trim() || query.trim() === '*';
  const searchText = isWildcard ? '' : query.trim();
  const resultLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 25;

  let sites = [];
  if (isWildcard) {
    const siteResponse = await fetch(`https://graph.microsoft.com/v1.0/sites?search=a&$top=10`, { headers: microsoftGraphHeaders() });
    if (siteResponse.ok) {
      sites = (await siteResponse.json()).value || [];
    }
    if (!sites.length) {
      const rootResponse = await fetch(`https://graph.microsoft.com/v1.0/sites/root`, { headers: microsoftGraphHeaders() });
      if (rootResponse.ok) {
        const rootSite = await rootResponse.json();
        if (rootSite?.id) sites = [rootSite];
      }
    }
  } else {
    const siteResponse = await fetch(`https://graph.microsoft.com/v1.0/sites?search=${encodeURIComponent(searchText)}&$top=10`, { headers: microsoftGraphHeaders() });
    if (!siteResponse.ok) {
      const errorBody = await siteResponse.text();
      throw new Error(`Microsoft Graph SharePoint site search failed with status ${siteResponse.status}: ${errorBody}`);
    }
    sites = (await siteResponse.json()).value || [];
    if (!sites.length) {
      const rootResponse = await fetch(`https://graph.microsoft.com/v1.0/sites/root`, { headers: microsoftGraphHeaders() });
      if (rootResponse.ok) {
        const rootSite = await rootResponse.json();
        if (rootSite?.id) sites = [rootSite];
      }
    }
  }

  if (!sites.length) {
    return {
      query: isWildcard ? '*' : searchText,
      files: [],
      message: 'No matching SharePoint sites found.'
    };
  }

  const escapedQuery = searchText.replace(/'/g, "''");
  const files = [];
  for (const site of sites) {
    if (files.length >= resultLimit) break;
    const driveUrl = isWildcard
      ? `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(site.id)}/drive/root/children?$top=${resultLimit - files.length}`
      : `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(site.id)}/drive/root/search(q='${encodeURIComponent(escapedQuery)}')?$top=${resultLimit - files.length}`;

    const driveResponse = await fetch(driveUrl, { headers: microsoftGraphHeaders() });
    if (!driveResponse.ok) continue;
    const driveItems = (await driveResponse.json()).value || [];
    files.push(...driveItems.map((resource) => ({ resource, siteName: site.displayName || site.name || '' })));
  }

  return {
    query: isWildcard ? '*' : searchText,
    files: files.slice(0, resultLimit).map(({ resource, siteName }) => ({
      id: resource.id,
      name: resource.name || 'Untitled SharePoint item',
      url: resource.webUrl || '',
      type: formatSharePointFileType(resource.file?.mimeType, resource.name),
      modifiedDate: resource.lastModifiedDateTime,
      siteName
    })),
    message: `Microsoft Graph returned ${files.length} SharePoint result${files.length === 1 ? '' : 's'} across ${sites.length} matching site${sites.length === 1 ? '' : 's'}.`
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
  },
  {
    type: 'function',
    function: {
      name: 'search_sharepoint_files',
      description: 'Searches SharePoint files that the configured Microsoft Graph token can access. This is read-only and returns matching file metadata and links.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search text for SharePoint items. Use * only when the user asks to list available items.' },
          limit: { type: 'integer', description: 'Unused compatibility field. SharePoint search results are shown in the browser.' }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_github',
      description: 'Searches GitHub issues and pull requests using the configured read-only GitHub token. Never exposes the token.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'GitHub search query, for example is:open label:bug.' },
          limit: { type: 'integer', description: 'Maximum number of results, from 1 to 25.' }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_github_repository',
      description: 'Describes a GitHub repository using read-only metadata.',
      parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: ['owner', 'repo'], additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_github_file',
      description: 'Reads a text file from a GitHub repository and returns its current sha for a guarded update.',
      parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, path: { type: 'string' }, branch: { type: 'string' } }, required: ['owner', 'repo', 'path'], additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_github_file',
      description: 'Updates a GitHub file. Always preview first and require explicit approval before calling with confirm true; include the current sha from get_github_file.',
      parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, path: { type: 'string' }, content: { type: 'string' }, message: { type: 'string' }, branch: { type: 'string' }, sha: { type: 'string' }, confirm: { type: 'boolean' } }, required: ['owner', 'repo', 'path', 'content', 'message'], additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_teams_calendar',
      description: 'Gets live Microsoft Teams/Microsoft 365 calendar events for the requested ISO date-time range.',
      parameters: { type: 'object', properties: { startDateTime: { type: 'string' }, endDateTime: { type: 'string' } }, required: ['startDateTime', 'endDateTime'], additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_outlook_messages',
      description: 'Gets live Outlook inbox messages through Microsoft Graph. This is read-only and returns recent or unread message metadata for analysis in the assistant.',
      parameters: {
        type: 'object',
        properties: {
          unreadOnly: { type: 'boolean', description: 'Set true when the user asks for unread mail only.' },
          limit: { type: 'integer', description: 'Maximum number of messages to return, from 1 to 100.' }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_teams_calendar_event',
      description: 'Creates a Microsoft Teams calendar event or Teams online meeting. Always preview first and require explicit approval before writing.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, timeZone: { type: 'string' }, location: { type: 'string' }, isOnlineMeeting: { type: 'boolean' }, attendees: { type: 'array', items: { type: 'string' } }, confirm: { type: 'boolean' }
        },
        required: ['title', 'start', 'end'],
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
  if (name === 'search_sharepoint_files') {
    return searchSharePointFiles(args);
  }
  if (name === 'search_github') {
    return searchGitHub(args);
  }
  if (name === 'get_github_repository') return getGithubRepository(args);
  if (name === 'get_github_file') return getGithubFile(args);
  if (name === 'update_github_file') return updateGithubFile(args);
  if (name === 'get_teams_calendar') {
    return fetchTeamsCalendar(args);
  }
  if (name === 'get_outlook_messages') {
    return fetchOutlookMessages(args);
  }
  if (name === 'create_teams_calendar_event') {
    return scheduleTeamsCalendarEvent(args);
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#f4f7fc',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:4200');
    return;
  }

  win.loadFile(path.join(__dirname, '../dist/ai-assistant/browser/index.html'));
}

ipcMain.handle('shell:open-path', async (_event, targetPath) => {
  const { shell } = require('electron');
  const exportRoot = path.resolve(__dirname, '../export');
  const resolved = targetPath ? path.resolve(__dirname, '..', targetPath) : exportRoot;
  if (resolved !== exportRoot && !resolved.startsWith(`${exportRoot}${path.sep}`)) {
    throw new Error('Path is outside the export folder.');
  }
  fs.mkdirSync(resolved, { recursive: true });
  return shell.openPath(resolved);
});

ipcMain.handle('file:write-export', async (_event, relativePath, content) => {
  if (typeof relativePath !== 'string' || !relativePath.startsWith('export/') || typeof content !== 'string') {
    throw new Error('Only text files under the export folder can be written.');
  }

  const exportRoot = path.resolve(__dirname, '../export');
  const resolved = path.resolve(__dirname, '..', relativePath);
  if (resolved !== exportRoot && !resolved.startsWith(`${exportRoot}${path.sep}`)) {
    throw new Error('Export path is outside the export folder.');
  }

  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, 'utf8');
  return resolved;
});

ipcMain.handle('ai-assistant:respond', async (_event, prompt, history) => {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('A non-empty prompt is required.');
  }

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
      content: 'You are the operations AI assistant for the Benefits Insights demo. Be concise, practical, and clearly state when you are making an assumption. Call get_current_sprint when the user needs live information about the current sprint, work-item state, ownership, delivery progress, backlog, blockers, or bugs. Call update_work_item when the user asks to change a work item status or state, set or rewrite its description, or add a comment or note to it; it needs the numeric work item id, so look the id up with get_current_sprint first when the user refers to an item by title. Call search_sharepoint_files when the user needs live SharePoint items, documents, pages, article links, policy files, knowledge hub content, or metadata across SharePoint. SharePoint access is read-only and browser-authenticated: provide the returned SharePoint search URL so the user can open live results in their signed-in browser session. Do not claim you read SharePoint result contents unless a tool result includes those contents. Do not offer to create, upload, replace, or update SharePoint files. Never write a work item change without explicit user approval: call update_work_item without confirm first, then state the target id and the exact change you intend to write, and ask the user to confirm. If any work item write details are missing or ambiguous, ask the user for them instead of guessing. Only call update_work_item with confirm set to true after the user has clearly approved that specific change in this conversation. Do not call tools for general explanations, drafting, or questions that do not require current Azure DevOps or SharePoint data. When tool results are available, treat them as the source of truth and include item IDs, titles, states, assignees, file names, links, authors, modified times, and SharePoint item types when relevant. Always return a JSON object with a required content string and an optional table object. Add table with string columns and string-array rows whenever the user asks for a list, records, work items, backlog, bugs, SharePoint items, files, documents, or a comparison. Omit table for a conversational answer. Also add an optional chart object with title, labels (strings), values (numbers, same length as labels), unit "number", and type "bar" or "pie" whenever the answer is a breakdown or distribution across categories. Use type "bar" for counts by status, state, or severity, and type "pie" for share across sprint lanes, channels, teams, or owners. Omit chart when there is nothing to compare.'
    },
    {
      role: 'system',
      content: 'Use get_teams_calendar for live Microsoft Teams or Microsoft 365 calendar questions. Use get_outlook_messages for live Outlook inbox, unread email, sender, priority, or approval-queue questions; it is read-only and returns message metadata. Use create_teams_calendar_event for scheduling requests: preview first and require explicit approval before calling with confirm true.'
    },
    {
      role: 'system',
      content: 'Use get_github_repository to describe repositories, search_github for issues and pull requests, and get_github_file before proposing code changes. For GitHub requests, ask for the real owner and repository if they are missing; never call a GitHub tool with placeholder values such as owner/repository. Use update_github_file only after showing the exact proposed content and receiving explicit approval; never write without confirm true and the current file sha.'
    },
    ...sanitizeHistory(history),
    { role: 'user', content: prompt }
  ];

  const completionUrl = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  const requestCompletion = async (withTools) => {
    const completionResponse = await fetch(completionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        messages,
        ...(withTools ? { tools: assistantTools, tool_choice: 'auto' } : {}),
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 4000
      })
    });

    if (!completionResponse.ok) {
      const errorBody = await completionResponse.text();
      let detail = errorBody;
      try {
        detail = JSON.parse(errorBody).error?.message ?? errorBody;
      } catch {
      }
      throw new Error(`Azure OpenAI request failed with status ${completionResponse.status}: ${detail}`);
    }

    const completionResult = await completionResponse.json();
    return completionResult.choices?.[0]?.message;
  };

  let assistantMessage = await requestCompletion(true);
  const usedSources = new Set();
  const failedSources = new Set();
  let awaitingConfirmation = false;

  for (let round = 0; round < 3; round += 1) {
    const toolCalls = (assistantMessage?.tool_calls ?? []).filter((call) => call.function?.name);
    if (!toolCalls.length) {
      break;
    }

    messages.push(assistantMessage);
    for (const call of toolCalls) {
      const source = call.function.name.includes('sharepoint') ? 'SharePoint' : call.function.name.includes('teams_calendar') ? 'Microsoft Teams Calendar' : call.function.name.includes('outlook') ? 'Outlook Mailbox' : 'Azure DevOps';
      usedSources.add(source);
      let toolResult;
      try {
        toolResult = await runAssistantTool(call.function.name, call.function.arguments);
      } catch (error) {
        toolResult = { error: error.message };
        failedSources.add(source);
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
  if (!usedSources.size) {
    return parseAssistantResponse(content, 'Azure OpenAI', actions);
  }

  const sourceLabel = [...usedSources].join(' + ');
  const failedLabel = [...failedSources].join(' + ');
  return parseAssistantResponse(
    content,
    failedSources.size ? `Azure OpenAI (${failedLabel} unavailable)` : `Azure OpenAI + ${sourceLabel}`,
    actions
  );
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

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

async function askAzureOpenAI(prompt) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '');
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
  if (!endpoint || !apiKey || !deployment || !apiVersion || apiKey.startsWith('replace-with-')) {
    throw new Error('Azure OpenAI is not configured in .env.');
  }

  let liveContext = '';
  if (/\bsprint\b|work items|backlog/i.test(prompt)) {
    const sprint = await fetchCurrentSprintItems();
    liveContext = `\nLive Azure DevOps current sprint (${sprint.iteration}):\n${JSON.stringify(sprint.items)}`;
  }

  const response = await fetch(
    `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are the operations AI assistant for the Benefits Insights demo. Be concise, practical, and clearly state when you are making an assumption. When live Azure DevOps sprint data is provided, use it as the source of truth and include item IDs, titles, states, and assignees when relevant.'
          },
          { role: 'user', content: `${prompt}${liveContext}` }
        ],
        temperature: 0.2,
        max_tokens: 800
      })
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    let detail = errorBody;
    try {
      detail = JSON.parse(errorBody).error?.message ?? errorBody;
    } catch {}
    throw new Error(`Azure OpenAI request failed with status ${response.status}: ${detail}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Azure OpenAI returned an empty response.');
  }
  return { content: content.trim(), source: 'Azure OpenAI' };
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
      const prompt = JSON.parse(body).prompt;
      if (typeof prompt !== 'string' || !prompt.trim()) {
        throw new Error('A non-empty prompt is required.');
      }
      const result = await askAzureOpenAI(prompt);
      response.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      response.end(JSON.stringify({ error: error.message }));
    }
  });
});

server.listen(3001, '127.0.0.1', () => {
  console.log('AI API listening on http://127.0.0.1:3001');
});

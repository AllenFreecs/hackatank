const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAssistantResponse, updateWorkItem, searchSharePointFiles, assistantTools, sanitizeHistory } = require('./api-server.js');

test('normalizes array-style assistant content into readable text and keeps a table', () => {
  const response = parseAssistantResponse(JSON.stringify({
    content: [
      'Here are all the items in the current sprint.',
      {
        id: 205283,
        type: 'Product Backlog Item',
        title: 'Product Backlog Item',
        state: 'Committed',
        assignedTo: 'Gaurav Patel'
      }
    ],
    table: {
      columns: ['ID', 'Type', 'Title', 'State', 'Assignee'],
      rows: [['205283', 'Product Backlog Item', 'Product Backlog Item', 'Committed', 'Gaurav Patel']]
    }
  }), 'Azure OpenAI + Azure DevOps');

  assert.match(response.content, /Here are all the items/);
  assert.match(response.content, /205283/);
  assert.equal(response.table.columns[0], 'ID');
  assert.equal(response.table.rows[0][4], 'Gaurav Patel');
});

test('merges several JSON objects emitted in one reply into readable text', () => {
  const response = parseAssistantResponse(
    '{"content":"Please specify the work item title or ID you want to update."}\n{"content":"I have the current sprint work items."}',
    'Azure OpenAI + Azure DevOps'
  );

  assert.equal(
    response.content,
    'Please specify the work item title or ID you want to update.\n\nI have the current sprint work items.'
  );
  assert.equal(response.table, undefined);
});

test('parses a fenced JSON reply and keeps its table', () => {
  const response = parseAssistantResponse(
    '```json\n{"content":"Current sprint items.","table":{"columns":["ID"],"rows":[["205283"]]}}\n```',
    'Azure OpenAI'
  );

  assert.equal(response.content, 'Current sprint items.');
  assert.equal(response.table.rows[0][0], '205283');
});

test('does not expose truncated JSON as the assistant message', () => {
  const response = parseAssistantResponse('{"content":"Current sprint items.","table":{"columns":["ID"],"rows":[["205283"]', 'Azure OpenAI');

  assert.doesNotMatch(response.content, /^\{"content"/);
  assert.match(response.content, /Current sprint items/);
});

test('exposes the work item update tool to the assistant', () => {
  const tool = assistantTools.find((entry) => entry.function.name === 'update_work_item');
  assert.ok(tool);
  assert.deepEqual(Object.keys(tool.function.parameters.properties), ['id', 'state', 'description', 'comment', 'confirm']);
  assert.deepEqual(tool.function.parameters.required, ['id']);
});

test('exposes the SharePoint search tool to the assistant', () => {
  const searchTool = assistantTools.find((entry) => entry.function.name === 'search_sharepoint_files');

  assert.ok(searchTool);
  assert.deepEqual(Object.keys(searchTool.function.parameters.properties), ['query', 'limit']);
  assert.deepEqual(searchTool.function.parameters.required, ['query']);
});

test('previews a work item update instead of applying it when unconfirmed', async () => {
  process.env.AZURE_DEVOPS_ORG_URL = 'https://dev.azure.com/contoso';
  process.env.AZURE_DEVOPS_DEFAULT_PROJECT = 'Demo';
  const preview = await updateWorkItem({ id: 205283, state: 'Done', comment: 'Testing passed.' });

  assert.equal(preview.requiresConfirmation, true);
  assert.equal(preview.applied, false);
  assert.equal(preview.id, 205283);
  assert.deepEqual(preview.proposedChanges, { state: 'Done', description: null, comment: 'Testing passed.' });
});

test('builds a browser SharePoint search URL without a token or document library', async () => {
  const originalSearchUrl = process.env.SHAREPOINT_SEARCH_URL;
  const originalSiteUrl = process.env.SHAREPOINT_SITE_URL;

  process.env.SHAREPOINT_SEARCH_URL = 'https://contoso.sharepoint.com/sites/Global/_layouts/15/search.aspx/files?q=onboarding';
  delete process.env.SHAREPOINT_SITE_URL;

  try {
    const result = await searchSharePointFiles({ query: 'onboarding', limit: 5 });
    assert.equal(result.searchUrl, 'https://contoso.sharepoint.com/sites/Global/_layouts/15/search.aspx/files?q=onboarding');
    assert.equal(result.files[0].url, result.searchUrl);
    assert.equal(result.files[0].type, 'Browser-authenticated SharePoint search');
  } finally {
    process.env.SHAREPOINT_SEARCH_URL = originalSearchUrl;
    process.env.SHAREPOINT_SITE_URL = originalSiteUrl;
  }
});

test('keeps only the last ten user and assistant turns in history', () => {
  const history = Array.from({ length: 14 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `turn ${index}` }));
  const sanitized = sanitizeHistory([...history, { role: 'system', content: 'ignored' }, { role: 'user', content: '  ' }]);

  assert.equal(sanitized.length, 10);
  assert.equal(sanitized[0].content, 'turn 4');
  assert.equal(sanitized.at(-1).content, 'turn 13');
});

test('rejects a work item update without a valid id', async () => {
  process.env.AZURE_DEVOPS_ORG_URL = 'https://dev.azure.com/contoso';
  process.env.AZURE_DEVOPS_DEFAULT_PROJECT = 'Demo';
  await assert.rejects(() => updateWorkItem({ id: 'abc', state: 'Done' }), /valid numeric work item id/);
});

test('rejects a work item update with no changes', async () => {
  process.env.AZURE_DEVOPS_ORG_URL = 'https://dev.azure.com/contoso';
  process.env.AZURE_DEVOPS_DEFAULT_PROJECT = 'Demo';
  await assert.rejects(() => updateWorkItem({ id: 205283, comment: '   ' }), /at least one of state, description, or comment/);
});

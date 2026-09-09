const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAssistantResponse, updateWorkItem, searchSharePointFiles, fetchOutlookMessages, assistantTools, sanitizeHistory } = require('./api-server.js');

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

test('searches SharePoint through Microsoft Graph and normalizes drive item results', async () => {
  const originalToken = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN;
  const originalFetch = global.fetch;
  process.env.MICROSOFT_GRAPH_ACCESS_TOKEN = 'test-graph-token';
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      async json() {
        if (url.includes('/sites?search=')) {
          return { value: [{ id: 'site-123', displayName: 'Global Benefits' }] };
        }
        return {
          value: [{
            id: 'file-123',
            name: 'Onboarding.docx',
            webUrl: 'https://contoso.sharepoint.com/sites/Global/Onboarding.docx',
            file: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
            lastModifiedDateTime: '2026-09-08T12:00:00Z'
          }]
        };
      }
    };
  };

  try {
    const result = await searchSharePointFiles({ query: 'onboarding', limit: 5 });
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, 'https://graph.microsoft.com/v1.0/sites?search=onboarding&$top=10');
    assert.equal(requests[1].url, "https://graph.microsoft.com/v1.0/sites/site-123/drive/root/search(q='onboarding')?$top=5");
    assert.equal(requests[0].options.headers.Authorization, 'Bearer test-graph-token');
    assert.equal(result.files.length, 1);
    assert.deepEqual(result.files[0], {
      id: 'file-123',
      name: 'Onboarding.docx',
      url: 'https://contoso.sharepoint.com/sites/Global/Onboarding.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      modifiedDate: '2026-09-08T12:00:00Z',
      siteName: 'Global Benefits'
    });
  } finally {
    process.env.MICROSOFT_GRAPH_ACCESS_TOKEN = originalToken;
    global.fetch = originalFetch;
  }
});

test('searches Outlook through Microsoft Graph and supports unread mail', async () => {
  const originalToken = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN;
  const originalFetch = global.fetch;
  process.env.MICROSOFT_GRAPH_ACCESS_TOKEN = 'test-graph-token';
  process.env.MICROSOFT_GRAPH_USER_ID = 'me';
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      async json() {
        return { value: [{
          id: 'message-123',
          subject: 'Budget approval',
          sender: { emailAddress: { name: 'CFO Office', address: 'cfo@example.com' } },
          importance: 'high',
          receivedDateTime: '2026-09-09T08:30:00Z',
          isRead: false,
          webLink: 'https://outlook.office.com/mail/message-123'
        }] };
      }
    };
  };

  try {
    const result = await fetchOutlookMessages({ unreadOnly: true, limit: 10 });
    assert.match(requests[0].url, /\/me\/mailFolders\/inbox\/messages\?/);
    assert.match(requests[0].url, /%24filter=isRead\+eq\+false/);
    assert.equal(requests[0].options.headers.Authorization, 'Bearer test-graph-token');
    assert.deepEqual(result.messages[0], {
      id: 'message-123',
      subject: 'Budget approval',
      sender: 'CFO Office',
      senderAddress: 'cfo@example.com',
      priority: 'High',
      received: '2026-09-09T08:30:00Z',
      isRead: false,
      webUrl: 'https://outlook.office.com/mail/message-123'
    });
  } finally {
    process.env.MICROSOFT_GRAPH_ACCESS_TOKEN = originalToken;
    global.fetch = originalFetch;
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

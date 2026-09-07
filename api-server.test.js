const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAssistantResponse } = require('./api-server.js');

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

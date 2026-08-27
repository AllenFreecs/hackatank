import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { ChatMessage } from '../../models/chat-message.model';
import { DataService } from './data.service';

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  constructor(private readonly dataService: DataService) {}

  respond(prompt: string): Observable<ChatMessage> {
    const lowered = prompt.toLowerCase();

    if (lowered.includes('revenue pipeline') || lowered.includes('closed-won trend')) {
      const performance = this.dataService.getBiPerformance();
      const latest = performance[performance.length - 1];
      const previous = performance[performance.length - 2];

      return this.reply({
        content: 'Power BI revenue pipeline is trending upward across the latest six-week workspace snapshot.',
        figures: [
          { label: 'Pipeline', value: this.formatCurrency(latest.pipeline), delta: this.deltaLabel(latest.pipeline, previous.pipeline) },
          { label: 'Closed-won', value: this.formatCurrency(latest.closedWon), delta: this.deltaLabel(latest.closedWon, previous.closedWon) },
          { label: 'Forecast', value: this.formatCurrency(latest.forecast), delta: this.deltaLabel(latest.forecast, previous.forecast) }
        ],
        chart: {
          title: 'Weekly closed-won revenue',
          labels: performance.map((entry) => entry.week),
          values: performance.map((entry) => entry.closedWon),
          unit: 'currency'
        },
        table: {
          columns: ['Week', 'Pipeline', 'Closed-won', 'Forecast', 'SLA'],
          rows: performance.map((entry) => [
            entry.week,
            this.formatCurrency(entry.pipeline),
            this.formatCurrency(entry.closedWon),
            this.formatCurrency(entry.forecast),
            `${entry.sla}%`
          ])
        },
        insight: `Closed-won revenue improved ${this.deltaLabel(latest.closedWon, performance[0].closedWon).toLowerCase()} from week 1 to week 6.`,
        source: 'Power BI Workspace'
      });
    }

    if (lowered.includes('report exceptions') || lowered.includes('exceptions and owners')) {
      const rows = this.dataService.getPendingByDepartment();
      const total = rows.reduce((sum, entry) => sum + entry.pending, 0);

      return this.reply({
        content: 'Power BI found the highest exception volume in HR, followed by Finance and Operations.',
        figures: [
          { label: 'Total exceptions', value: `${total}` },
          { label: 'Highest owner group', value: rows[0].department, delta: `${rows[0].pending} pending` },
          { label: 'Automation candidates', value: '27' }
        ],
        chart: {
          title: 'Pending report exceptions by department',
          labels: rows.map((entry) => entry.department),
          values: rows.map((entry) => entry.pending),
          unit: 'number'
        },
        table: {
          columns: ['Department', 'Pending exceptions'],
          rows: rows.map((entry) => [entry.department, `${entry.pending}`])
        },
        insight: 'HR owns 46% of current pending exceptions, mostly from onboarding report checks.',
        source: 'Power BI Workspace',
        actions: ['Create Summary', 'Show Details', 'Create Tasks']
      });
    }

    if (lowered.includes('azure task health') || lowered.includes('azure tasks')) {
      const tasks = this.dataService.getTasksSnapshot();
      const statusCounts = this.countBy(tasks.map((entry) => entry.status));
      const pendingTasks = tasks.filter((entry) => entry.status === 'Pending');
      const departmentCounts = this.countBy(pendingTasks.map((entry) => entry.department));

      return this.reply({
        content: 'Azure Monitor is tracking task health across operational owners, with pending work concentrated in HR and Finance.',
        figures: [
          { label: 'Total tasks', value: `${tasks.length}` },
          { label: 'Pending tasks', value: `${pendingTasks.length}` },
          { label: 'Top queue', value: departmentCounts[0]?.label ?? 'None', delta: `${departmentCounts[0]?.value ?? 0} pending` }
        ],
        chart: {
          title: 'Azure task health by status',
          labels: statusCounts.map((entry) => entry.label),
          values: statusCounts.map((entry) => entry.value),
          unit: 'number'
        },
        table: {
          columns: ['Task', 'Owner', 'Department', 'Status'],
          rows: tasks.map((entry) => [entry.title, entry.owner, entry.department, entry.status])
        },
        insight: 'Pending operational tasks are the primary workload risk in the Azure task monitor view.',
        source: 'Azure Monitor'
      });
    }

    if (lowered.includes('azure sprint') || lowered.includes('sprint work')) {
      const lanes = this.dataService.getSprintBoard();
      const laneCounts = lanes.map((entry) => ({ label: entry.lane, value: entry.items.length }));
      const azureItems = lanes.flatMap((lane) => lane.items.map((item) => ({ ...item, lane: lane.lane }))).filter((item) => item.tag === 'Azure');

      return this.reply({
        content: 'Azure Monitor is displaying sprint delivery by lane, with Azure-tagged work split between Backlog and Review.',
        figures: [
          { label: 'Sprint items', value: `${laneCounts.reduce((sum, entry) => sum + entry.value, 0)}` },
          { label: 'Azure items', value: `${azureItems.length}` },
          { label: 'Active lanes', value: `${lanes.length}` }
        ],
        chart: {
          title: 'Sprint work by lane',
          labels: laneCounts.map((entry) => entry.label),
          values: laneCounts.map((entry) => entry.value),
          unit: 'number'
        },
        table: {
          columns: ['Sprint item', 'Owner', 'Tag', 'Lane'],
          rows: lanes.flatMap((lane) => lane.items.map((item) => [item.title, item.owner, item.tag, lane.lane]))
        },
        insight: 'Azure cost drift alerting is already in review, while token refresh monitoring remains in backlog.',
        source: 'Azure Monitor'
      });
    }

    if (lowered.includes('azure power bi') || lowered.includes('pbi monitor') || lowered.includes('power bi monitor')) {
      const performance = this.dataService.getBiPerformance();
      const latest = performance[performance.length - 1];
      const averageSla = Math.round(performance.reduce((sum, entry) => sum + entry.sla, 0) / performance.length);

      return this.reply({
        content: 'Azure Monitor is watching Power BI refresh performance, revenue signal health, and SLA stability from the workspace feed.',
        figures: [
          { label: 'Latest SLA', value: `${latest.sla}%` },
          { label: 'Avg. SLA', value: `${averageSla}%` },
          { label: 'Latest forecast', value: this.formatCurrency(latest.forecast) }
        ],
        chart: {
          title: 'Power BI workspace SLA trend',
          labels: performance.map((entry) => entry.week),
          values: performance.map((entry) => entry.sla),
          unit: 'percent'
        },
        table: {
          columns: ['Week', 'SLA', 'Forecast', 'Closed-won'],
          rows: performance.map((entry) => [entry.week, `${entry.sla}%`, this.formatCurrency(entry.forecast), this.formatCurrency(entry.closedWon)])
        },
        insight: 'Power BI SLA is healthy at 99% in the latest week, so revenue reporting risk is low.',
        source: 'Azure Monitor'
      });
    }

    if (lowered.includes('azure bugs') || lowered.includes('bugs by severity')) {
      const bugs = [
        { severity: 'Critical', count: 1, owner: 'Cloud NOC' },
        { severity: 'High', count: 3, owner: 'Automation Team' },
        { severity: 'Medium', count: 5, owner: 'Platform Squad' },
        { severity: 'Low', count: 2, owner: 'Operations PMO' }
      ];
      const total = bugs.reduce((sum, entry) => sum + entry.count, 0);

      return this.reply({
        content: 'Azure Monitor bug tracking shows eleven open issues, with medium severity forming the largest group.',
        figures: [
          { label: 'Open bugs', value: `${total}` },
          { label: 'Critical bugs', value: `${bugs[0].count}` },
          { label: 'Top owner', value: bugs[2].owner, delta: `${bugs[2].count} medium` }
        ],
        chart: {
          title: 'Azure bugs by severity',
          labels: bugs.map((entry) => entry.severity),
          values: bugs.map((entry) => entry.count),
          unit: 'number'
        },
        table: {
          columns: ['Severity', 'Open bugs', 'Owner'],
          rows: bugs.map((entry) => [entry.severity, `${entry.count}`, entry.owner])
        },
        insight: 'The critical issue should stay with Cloud NOC while medium defects can be batched into the platform sprint.',
        source: 'Azure Monitor'
      });
    }

    if (
      lowered.includes('sharepoint file') ||
      lowered.includes('files related') ||
      lowered.includes('document links') ||
      lowered.includes('files and links')
    ) {
      const query = this.extractDocumentQuery(prompt);
      const matches = this.dataService.searchDocuments(query);
      const documents = matches.length ? matches : this.dataService.getDocumentsSnapshot();
      const topDocument = [...documents].sort((a, b) => b.relevance - a.relevance)[0];

      return this.reply({
        content: `Found ${documents.length} SharePoint file${documents.length === 1 ? '' : 's'} related to "${query}".`,
        figures: [
          { label: 'Files found', value: `${documents.length}` },
          { label: 'Top match', value: topDocument?.name ?? 'None' },
          { label: 'Top relevance', value: `${topDocument?.relevance ?? 0}%` }
        ],
        fileLinks: documents.map((entry) => ({
          name: entry.name,
          url: this.sharePointFileUrl(entry.name),
          category: entry.category,
          summary: entry.summary
        })),
        table: {
          columns: ['File', 'Category', 'Relevance', 'Updated', 'Link'],
          rows: documents.map((entry) => [entry.name, entry.category, `${entry.relevance}%`, entry.updatedDate, this.sharePointFileUrl(entry.name)])
        },
        insight: 'These links open the matching SharePoint knowledge files for review.',
        source: 'SharePoint Knowledge Hub',
        actions: ['Open Top Article']
      });
    }

    if (lowered.includes('finance approval policy articles')) {
      const related = this.dataService.lookupSharePointArticles('finance approval');

      return this.reply({
        content: `Found ${related.length} finance approval policy article${related.length === 1 ? '' : 's'} with measurable relevance scores.`,
        figures: [
          { label: 'Policy hits', value: `${related.length}` },
          { label: 'Top relevance', value: `${related[0]?.relevance ?? 0}%` },
          { label: 'Primary category', value: related[0]?.category ?? 'Finance' }
        ],
        chart: {
          title: 'Finance policy article relevance',
          labels: related.map((entry) => entry.name.replace('.xlsx', '').replace('.pdf', '')),
          values: related.map((entry) => entry.relevance),
          unit: 'percent'
        },
        table: {
          columns: ['Article', 'Category', 'Relevance'],
          rows: related.map((entry) => [entry.name, entry.category, `${entry.relevance}%`])
        },
        source: 'SharePoint Knowledge Hub',
        actions: ['Open Top Article']
      });
    }

    if (lowered.includes('teams activity')) {
      const activity = [
        { label: 'Mentions', value: 18 },
        { label: 'Replies', value: 42 },
        { label: 'Reactions', value: 31 },
        { label: 'Files shared', value: 7 }
      ];

      return this.reply({
        content: 'Teams activity is highest around replies and reactions, with file sharing concentrated in operations channels.',
        figures: [
          { label: 'Activity events', value: `${activity.reduce((sum, entry) => sum + entry.value, 0)}` },
          { label: 'Top activity', value: activity[1].label, delta: `${activity[1].value} events` },
          { label: 'Files shared', value: `${activity[3].value}` }
        ],
        chart: {
          title: 'Teams activity by type',
          labels: activity.map((entry) => entry.label),
          values: activity.map((entry) => entry.value),
          unit: 'number'
        },
        table: {
          columns: ['Activity', 'Count'],
          rows: activity.map((entry) => [entry.label, `${entry.value}`])
        },
        source: 'Teams Calendar',
        actions: ['Comment on Thread']
      });
    }

    if (lowered.includes('teams chats')) {
      const chats = [
        { channel: '#ops-command', count: 34, owner: 'Ana Lim' },
        { channel: 'Finance Insights', count: 21, owner: 'Ravi Shah' },
        { channel: 'Incident Room', count: 18, owner: 'Cloud NOC' },
        { channel: 'Exec Ops', count: 12, owner: 'Marjorie Ong' }
      ];

      return this.reply({
        content: 'Teams chat volume is led by the operations command channel, followed by Finance Insights.',
        figures: [
          { label: 'Chat messages', value: `${chats.reduce((sum, entry) => sum + entry.count, 0)}` },
          { label: 'Top channel', value: chats[0].channel },
          { label: 'Active channels', value: `${chats.length}` }
        ],
        chart: {
          title: 'Teams chats by channel',
          labels: chats.map((entry) => entry.channel),
          values: chats.map((entry) => entry.count),
          unit: 'number'
        },
        table: {
          columns: ['Channel', 'Messages', 'Owner'],
          rows: chats.map((entry) => [entry.channel, `${entry.count}`, entry.owner])
        },
        source: 'Teams Calendar',
        actions: ['Post Comment to Thread']
      });
    }

    if (lowered.includes('teams calendar workload') || lowered.includes('meeting duration by owner') || lowered.includes('teams schedule')) {
      const events = this.dataService.getTeamsCalendar();
      const durations = events.map((entry) => this.durationMinutes(entry.duration));
      const totalMinutes = durations.reduce((sum, minutes) => sum + minutes, 0);
      const longestIndex = durations.indexOf(Math.max(...durations));

      return this.reply({
        content: 'Teams Calendar shows four operational meetings today, with the Power BI capacity review taking the largest block.',
        figures: [
          { label: 'Meetings today', value: `${events.length}` },
          { label: 'Total focus time', value: `${totalMinutes}m` },
          { label: 'Longest meeting', value: events[longestIndex]?.title ?? 'None' }
        ],
        chart: {
          title: 'Meeting duration by event',
          labels: events.map((entry) => entry.title.replace('MCP ', '').replace('Power BI ', '').replace('Outlook ', '')),
          values: durations,
          unit: 'number'
        },
        table: {
          columns: ['Meeting', 'Time', 'Duration', 'Owner'],
          rows: events.map((entry) => [entry.title, entry.time, entry.duration, entry.owner])
        },
        insight: 'The calendar has a clean triage rhythm: standup, analytics review, Azure triage, then Outlook approvals.',
        source: 'Teams Calendar',
        actions: ['Set Calendar Event', 'Comment on Thread']
      });
    }

    if (lowered.includes('teams calls')) {
      const calls = [
        { type: '1:1 calls', count: 6, minutes: 48 },
        { type: 'Group calls', count: 3, minutes: 72 },
        { type: 'External calls', count: 2, minutes: 35 },
        { type: 'Missed calls', count: 4, minutes: 0 }
      ];

      return this.reply({
        content: 'Teams call activity is moderate today, with group calls consuming the most time.',
        figures: [
          { label: 'Calls today', value: `${calls.reduce((sum, entry) => sum + entry.count, 0)}` },
          { label: 'Call minutes', value: `${calls.reduce((sum, entry) => sum + entry.minutes, 0)}m` },
          { label: 'Missed calls', value: `${calls[3].count}` }
        ],
        chart: {
          title: 'Teams call minutes by type',
          labels: calls.map((entry) => entry.type),
          values: calls.map((entry) => entry.minutes),
          unit: 'number'
        },
        table: {
          columns: ['Call type', 'Calls', 'Minutes'],
          rows: calls.map((entry) => [entry.type, `${entry.count}`, `${entry.minutes}`])
        },
        source: 'Teams Calendar'
      });
    }

    if (lowered.includes('teams channels')) {
      const channels = [
        { name: '#ops-command', posts: 16, members: 24 },
        { name: 'Finance Insights', posts: 9, members: 14 },
        { name: 'Incident Room', posts: 11, members: 10 },
        { name: 'Exec Ops', posts: 6, members: 8 }
      ];

      return this.reply({
        content: 'Teams channel engagement is strongest in #ops-command, with Incident Room showing high activity for its size.',
        figures: [
          { label: 'Channels', value: `${channels.length}` },
          { label: 'Total posts', value: `${channels.reduce((sum, entry) => sum + entry.posts, 0)}` },
          { label: 'Top channel', value: channels[0].name }
        ],
        chart: {
          title: 'Teams channel posts',
          labels: channels.map((entry) => entry.name),
          values: channels.map((entry) => entry.posts),
          unit: 'number'
        },
        table: {
          columns: ['Channel', 'Posts', 'Members'],
          rows: channels.map((entry) => [entry.name, `${entry.posts}`, `${entry.members}`])
        },
        source: 'Teams Calendar',
        actions: ['Comment on Thread']
      });
    }

    if (lowered.includes('teams follow-up load')) {
      const meeting = this.dataService.getMeetingSummary();
      const ownerCounts = this.countBy(meeting.actionItems.map((entry) => entry.owner));

      return this.reply({
        content: 'Today\'s meeting summary produced measurable follow-up work across the listed owners.',
        figures: [
          { label: 'Action items', value: `${meeting.actionItems.length}` },
          { label: 'Decisions', value: `${meeting.decisions.length}` },
          { label: 'Top owner', value: ownerCounts[0]?.label ?? 'None' }
        ],
        chart: {
          title: 'Follow-up load by owner',
          labels: ownerCounts.map((entry) => entry.label),
          values: ownerCounts.map((entry) => entry.value),
          unit: 'number'
        },
        meetingSummary: {
          summary: meeting.summary,
          decisions: meeting.decisions,
          actionItems: meeting.actionItems
        },
        source: 'Teams Calendar',
        actions: ['Create Tasks']
      });
    }

    if (lowered.includes('outlook email priority') || lowered.includes('outlook approval queue') || lowered.includes('pending approval emails')) {
      const messages = this.dataService.getOutlookQueue();
      const priorityCounts = this.countBy(messages.map((entry) => entry.priority));
      const highPriority = messages.filter((entry) => entry.priority === 'High').length;

      return this.reply({
        content: 'Outlook Mailbox has four pending approval emails, with one high-priority message from the CFO Office.',
        figures: [
          { label: 'Pending emails', value: `${messages.length}` },
          { label: 'High priority email', value: `${highPriority}` },
          { label: 'Newest email', value: messages[0]?.received ?? 'None' }
        ],
        chart: {
          title: 'Outlook emails by priority',
          labels: priorityCounts.map((entry) => entry.label),
          values: priorityCounts.map((entry) => entry.value),
          unit: 'number'
        },
        table: {
          columns: ['Email subject', 'Sender', 'Priority', 'Received'],
          rows: messages.map((entry) => [entry.subject, entry.sender, entry.priority, entry.received])
        },
        insight: 'Budget variance approval should be handled first because it is the only high-priority email.',
        source: 'Outlook Mailbox',
        actions: ['Draft Email', 'Send']
      });
    }

    if (lowered.includes('outlook emails by sender') || lowered.includes('outlook mailbox workload') || lowered.includes('unread outlook email')) {
      const messages = this.dataService.getOutlookQueue();
      const senderScores = messages.map((entry) => ({ label: entry.sender, value: this.priorityScore(entry.priority) }));

      return this.reply({
        content: 'Outlook email workload is light but weighted toward executive and procurement senders.',
        figures: [
          { label: 'Unread emails', value: `${messages.length}` },
          { label: 'Email priority score', value: `${senderScores.reduce((sum, entry) => sum + entry.value, 0)}` },
          { label: 'Top sender', value: senderScores[0]?.label ?? 'None' }
        ],
        chart: {
          title: 'Outlook email workload by sender',
          labels: senderScores.map((entry) => entry.label),
          values: senderScores.map((entry) => entry.value),
          unit: 'number'
        },
        table: {
          columns: ['Sender', 'Email subject', 'Priority score'],
          rows: messages.map((entry) => [entry.sender, entry.subject, `${this.priorityScore(entry.priority)}`])
        },
        source: 'Outlook Mailbox'
      });
    }

    if (lowered.includes('follow-up email') || lowered.includes('overdue approvals')) {
      const messages = this.dataService.getOutlookQueue().filter((entry) => entry.priority !== 'Low');

      return this.reply({
        content: 'Follow-up email draft prepared for the pending high and medium priority approvals.',
        figures: [
          { label: 'Emails referenced', value: `${messages.length}` },
          { label: 'Recipients', value: `${messages.length}` },
          { label: 'Tone', value: 'Concise' }
        ],
        emailDraft: {
          subject: 'Follow-up: Pending approval emails',
          body: `Hello team,\n\nFollowing up on the pending approval emails currently in the Outlook queue:\n\n${messages
            .map((entry) => `- ${entry.subject} from ${entry.sender} (${entry.priority})`)
            .join('\n')}\n\nPlease review and confirm the next action today so we can keep the approval queue moving.\n\nBest regards,\nAI Assistant`
        },
        table: {
          columns: ['Email subject', 'Sender', 'Priority'],
          rows: messages.map((entry) => [entry.subject, entry.sender, entry.priority])
        },
        source: 'Outlook Mailbox',
        actions: ['Send']
      });
    }

    if (
      lowered.includes('set calendar') ||
      lowered.includes('schedule meeting') ||
      lowered.includes('calendar event') ||
      lowered.includes('book meeting')
    ) {
      return this.reply({
        content: 'Prepared a Teams/Outlook meeting draft for tomorrow at 10:30 AM (45m) with Finance and Operations leads.',
        table: {
          columns: ['Field', 'Value'],
          rows: [
            ['Title', 'MCP Weekly Sync'],
            ['Time', '10:30 AM'],
            ['Duration', '45m'],
            ['Owner', 'Operations PMO'],
            ['Channel', 'Teams / Exec Ops']
          ]
        },
        actions: ['Set Calendar Event', 'Comment on Thread', 'Find Related SharePoint Articles']
      });
    }

    if (
      lowered.includes('comment on thread') ||
      lowered.includes('post in teams') ||
      lowered.includes('thread update')
    ) {
      return this.reply({
        content:
          'Drafted a Teams thread update: "Power BI refresh completed, Azure alert triage in progress, and Outlook approvals are queued for sign-off."',
        actions: ['Post Comment to Thread', 'Set Calendar Event', 'Find Related SharePoint Articles']
      });
    }

    if (
      lowered.includes('sharepoint') ||
      lowered.includes('related article') ||
      lowered.includes('lookup article') ||
      lowered.includes('knowledge lookup')
    ) {
      const lookupTerm = this.extractLookupTerm(prompt);
      const related = this.dataService.lookupSharePointArticles(lookupTerm);

      if (!related.length) {
        return this.reply({
          content: `No SharePoint articles matched "${lookupTerm}". Try a broader query like onboarding, finance approval, or procurement.`,
          actions: ['Set Calendar Event', 'Post Comment to Thread']
        });
      }

      return this.reply({
        content: `Found ${related.length} related SharePoint article${related.length > 1 ? 's' : ''} for "${lookupTerm}".`,
        source: 'SharePoint Knowledge Hub',
        table: {
          columns: ['Article', 'Category', 'Relevance'],
          rows: related.map((entry) => [entry.name, entry.category, `${entry.relevance}%`])
        },
        actions: ['Open Top Article', 'Post Comment to Thread', 'Set Calendar Event']
      });
    }

    if (lowered.includes('pending tasks') || lowered.includes('departments have')) {
      const pending = this.dataService.getPendingByDepartment();
      const total = pending.reduce((sum, entry) => sum + entry.pending, 0);
      const rows = pending.map((entry) => [entry.department, `${entry.pending}`]);
      return this.reply({
        content: 'Based on the current operational data, HR has the highest number of pending tasks.',
        figures: [
          { label: 'Pending tasks', value: `${total}` },
          { label: 'Highest department', value: pending[0].department, delta: `${pending[0].pending} tasks` },
          { label: 'Departments', value: `${pending.length}` }
        ],
        chart: {
          title: 'Pending tasks by department',
          labels: pending.map((entry) => entry.department),
          values: pending.map((entry) => entry.pending),
          unit: 'number'
        },
        table: { columns: ['Department', 'Pending'], rows },
        insight: "HR represents 46% of all pending tasks. The largest contributor is employee onboarding.",
        actions: ['Create Summary', 'Show Details', 'Draft Email', 'Create Tasks']
      });
    }

    if (lowered.includes('why does hr have so many pending tasks')) {
      return this.reply({
        content: "The largest contributor is employee onboarding, representing 61% of HR's pending tasks.",
        actions: ['Find Onboarding Procedure', 'Draft Email', 'Create Automation']
      });
    }

    if (lowered.includes('onboarding procedure') || lowered.includes('find the onboarding procedure')) {
      return this.reply({
        content: 'I found the latest onboarding reference document.',
        source: 'Employee Onboarding Procedure.pdf',
        insight: 'The process still includes manual verification steps that can be automated.',
        actions: ['Summarize Improvements', 'Draft Email', 'Create Automation']
      });
    }

    if (lowered.includes('summarize what needs to be improved')) {
      return this.reply({
        content: 'The procedure contains several manual verification steps that could be automated.',
        actions: ['Draft Email', 'Create Automation']
      });
    }

    if (lowered.includes('purchase request')) {
      const policy = this.dataService.getPurchaseRequestPolicy();
      return this.reply({
        content: policy.answer,
        source: policy.source
      });
    }

    if (lowered.includes('sales')) {
      const sales = this.dataService.getSales();
      const previous = sales[0];
      const current = sales[1];
      if (!previous || !current) {
        return this.reply({ content: 'Sales data is currently unavailable.' });
      }
      const percent = ((current.amount - previous.amount) / previous.amount) * 100;
      return this.reply({
        content: `Sales increased from ₱${previous.amount.toLocaleString()} in ${previous.month} to ₱${current.amount.toLocaleString()} in ${current.month}.`,
        insight: `That is a ${percent.toFixed(2)}% month-over-month increase.`
      });
    }

    if (lowered.includes('summarize today') || lowered.includes('summarize this meeting')) {
      const meeting = this.dataService.getMeetingSummary();
      return this.reply({
        content: 'Meeting summary prepared.',
        meetingSummary: {
          summary: meeting.summary,
          decisions: meeting.decisions,
          actionItems: meeting.actionItems
        },
        actions: ['Create Tasks']
      });
    }

    if (lowered.includes('what should we automate') || lowered.includes('manually checking reports')) {
      const opportunities = [
        { label: 'Report validation', value: 42 },
        { label: 'Approval routing', value: 31 },
        { label: 'Knowledge lookup', value: 18 },
        { label: 'Calendar follow-ups', value: 14 }
      ];

      return this.reply({
        content: 'I found a potential automation opportunity.',
        figures: [
          { label: 'Top opportunity', value: 'Report validation' },
          { label: 'Opportunity score', value: '42' },
          { label: 'Estimated impact', value: 'High' }
        ],
        chart: {
          title: 'Automation opportunity score',
          labels: opportunities.map((entry) => entry.label),
          values: opportunities.map((entry) => entry.value),
          unit: 'number'
        },
        automationSuggestion: {
          name: 'Automated Report Validation',
          currentProcess: ['Download report', 'Check missing values', 'Compare totals', 'Email exceptions'],
          improvement: 'Automatically validate the report and notify the owner only when exceptions are found.',
          opportunity: 'High'
        },
        actions: ['Explore', 'Create Prototype', 'Save Idea']
      });
    }

    if (lowered.includes('draft an email')) {
      return this.reply({
        content: 'Email draft prepared.',
        emailDraft: {
          subject: 'Operations Report Delay',
          body:
            'Hello Finance Team,\n\nWe detected a delay in this week\'s operations report due to unresolved verification checks. We recommend automating the validation workflow to reduce manual review and prevent recurring delays.\n\nBest regards,\nAI Assistant'
        },
        actions: ['Copy', 'Edit', 'Send']
      });
    }

    return this.reply({
      content:
        'I can help with reporting, knowledge search, meeting summaries, email drafting, and automation suggestions. Try one of the suggested prompts.',
      actions: ['Show Prompt Suggestions']
    });
  }

  private reply(partial: Omit<ChatMessage, 'id' | 'role' | 'timestamp'>): Observable<ChatMessage> {
    return of({
      id: Date.now(),
      role: 'assistant' as const,
      timestamp: new Date().toISOString(),
      ...partial
    }).pipe(delay(900));
  }

  private extractLookupTerm(prompt: string): string {
    const lowered = prompt.toLowerCase();
    const markers = ['for ', 'about ', 'on '];
    for (const marker of markers) {
      const idx = lowered.indexOf(marker);
      if (idx >= 0) {
        const value = prompt.slice(idx + marker.length).trim();
        if (value.length > 2) {
          return value.replace(/[?.!,]+$/, '');
        }
      }
    }
    return 'operations';
  }

  private extractDocumentQuery(prompt: string): string {
    const lowered = prompt.toLowerCase();
    const phraseMap: Array<[string, string]> = [
      ['employee onboarding', 'employee onboarding'],
      ['onboarding', 'onboarding'],
      ['finance approval', 'finance approval'],
      ['finance approvals', 'finance approval'],
      ['procurement', 'procurement'],
      ['support sla', 'support sla'],
      ['sla', 'sla']
    ];

    const match = phraseMap.find(([phrase]) => lowered.includes(phrase));
    return match?.[1] ?? this.extractLookupTerm(prompt);
  }

  private sharePointFileUrl(fileName: string): string {
    return `https://contoso.sharepoint.com/sites/knowledge-hub/Shared%20Documents/${encodeURIComponent(fileName)}`;
  }

  private formatCurrency(value: number): string {
    return `₱${value.toLocaleString()}`;
  }

  private deltaLabel(current: number, previous: number): string {
    const percent = ((current - previous) / previous) * 100;
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
  }

  private countBy(values: string[]): Array<{ label: string; value: number }> {
    const counts = values.reduce<Record<string, number>>((result, value) => {
      result[value] = (result[value] ?? 0) + 1;
      return result;
    }, {});

    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }

  private durationMinutes(duration: string): number {
    const match = duration.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  private priorityScore(priority: 'High' | 'Medium' | 'Low'): number {
    return { High: 3, Medium: 2, Low: 1 }[priority];
  }
}

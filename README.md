## Quickstart
Ideally should be `docker compose up`.

## What is this?
Davai is an issue tracker. You've used issue trackers. This is like them.

In a world ever more rapidly approaching more and more agent-driven-development state, a few problems arise:
- Changing agent hosts is painful. Re-building the important context is painful

## What's different?
This is intended to be used primarily by agents. To create, edit, and update tickets, but not resolve them - that one's on you.

This is done via a different ways:
- MCP tooling allowing most actions we want to allow an agent to do.
- Special fields for agents - such as "LLM context" and a "Progress" list. The idea is this:
  - "LLM context" is more or less equivalent to a skill but focussed on the specific work item. It will contain relevant context so an agent can pick up quickly.
  - "Progress" list is more or less like a branch with commits. It's not intended to be edited, but updated as the work item moves forwards. Each one requires "proof" of the work, e.g. commit sha, PR link, or even a link to a Jira or Github Issues for a blocker; and a "agent_id" which guides the agent to put its own agent/model/session and host in there so you can find that session again if you need to.

Marking as done, i.e. resolving, an item can only be done by the human. The furthrest an agent can get to is "Review". This is intentional.

## Supported types of tickets/work items
Taking an approach closer to Jira, items are separated in these categories:
- Projects, sprints, releases
- Work item, e.g. ticket or issue, equivalent
- User support
- Incident
- Monitoring log

They are also exposed differently through the MCP tools. This helps the agents decide and search. Could it be done via a main WorkItem model and MCP tools that hard-code different types? Yeah probably, but it wasn't.

## Projects and Work items
Classic project contains work item/ticket/issue structure. Each project can have sprints and releases. Each sprint and releases can have work items. Each work item can have sub-tasks of other work items.

Work items contain what you'd expect: status, priority, assignee, sprint, release, start date, target date, description, sub-tasks, progress, llm agent context.


## Monitoring logs + incidents
This is intended to be used primarily by agents which are put into a operational monitoring capacity. Flash models are cheap enough to run as an expensive (in comparison) monitoring software which can reason whether it needs to report a monitoring log or open a full incident.

A monitoring log can link itself to an incident. This means Incidents will contain relevant logs that were found at the time of incident detection, and any notes from the agent performing an initial investigation.

Incidents contain:
- Investigation cause and details
- Quick investigation note (recurrence check) - this can be grabbed quickly to check if this is a recurrence of an incident
- Linked work items
- Linked monitoring logs
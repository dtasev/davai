first model is a work item, it has the usual fields:

model WorkItem:
title: str
descr: text field
created: datetime
created_by: User
updated: datetime - updated on changes
updated_by: User
active_assignee: User|None
assigned: 0 -> many User
watching: 0 -> many User
source: link or description of the source of this work item
start_date: datetime, this is for planning, related to showing in a timeline or sprint
target_date: datetime, on the other end of start_date
sprint: Sprint
project: Project
status: default of the Project's available statuses
release: Release

# LLM-helping fields for Workitem
context: Context
progress: Progress

model Project
name: str
description: text field

all projects should start with default statuses: todo, in progress, review, waiting, done, cancelled. we don't need transitions

model ProjectStatus:
project: Project
name: str

model Sprint
name:str
description: text field
start_date: datetime
end_date: datetime
work_items: WorkItem[]
release: Release

model Release
name: str
description: text field
start_date: datetime
end_date: datetime
work_items: WorkItem[]

model Context:
# Treated like a SKILL.md: single, unversioned source of truth reflecting only the latest facts, technical specifications, and architecture constraints. It has NO version history — updating it replaces/overwrites the previous value entirely (not an append log). Chronological milestones and timeline belong in the Progress model. Surfaced with user/updated_by and timestamp so readers can evaluate staleness.
work_item: WorkItem
user: User
timestamp: datetime
summary: str

model Progress:
# finished tasks, or the steps in development, or high level context of the work and decisions
work_item: WorkItem
user: User
milestones: Milestone[]

model Milestone:
t: str
timestamp: datetime
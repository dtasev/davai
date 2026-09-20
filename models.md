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
# the idea is this is updated by the LLM agent on implementing bigger milestones, and should propose a value and ask the user to confirm before updating. It should be treated like a SKILL.md where it gives context for the work that has been done by the developer. It's probably OK if this is environment specific. A breakdown of completed tasks can be logged in the Progress model
work_item: WorkItem
user: User
timestamp: datetime
t: str

model Progress:
# finished tasks, or the steps in development, or high level context of the work and decisions
work_item: WorkItem
user: User
milestones: Milestone[]

model Milestone:
t: str
timestamp: datetime
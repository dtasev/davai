import { FolderGit2, ArrowRight, ListTodo } from 'lucide-react'
import { Project } from '../../types'

interface ProjectCardProps {
  project: Project
  onClick: (projectKey: string) => void
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div
      onClick={() => onClick(project.key)}
      className="group bg-zinc-900/60 border border-zinc-800/80 hover:border-indigo-500/50 rounded-xl p-5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-indigo-500/5 flex flex-col justify-between"
      data-testid={`project-card-${project.key}`}
    >
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition shrink-0">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-mono text-xs font-bold text-indigo-400">
                {project.key}
              </span>
              <h3 className="font-bold text-sm sm:text-base text-zinc-100 group-hover:text-white transition truncate">
                {project.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-300 shrink-0">
            <ListTodo className="w-3.5 h-3.5 text-indigo-400" />
            <span>{project.item_count} items</span>
          </div>
        </div>

        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
          {project.description || 'No description provided for this project workspace.'}
        </p>
      </div>

      <div className="pt-3.5 mt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-1 overflow-hidden">
          {project.statuses?.slice(0, 4).map(st => (
            <span
              key={st.id}
              className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800/80 text-zinc-400 capitalize leading-none"
            >
              {st.name}
            </span>
          ))}
          {(project.statuses?.length || 0) > 4 && (
            <span className="text-[10px] text-zinc-600 leading-none">
              +{project.statuses.length - 4} more
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-zinc-400 group-hover:text-indigo-400 font-medium transition text-xs">
          <span>Open</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  )
}

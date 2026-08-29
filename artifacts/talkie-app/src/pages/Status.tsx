import { useState } from 'react'
import TopBar from '@/components/TopBar'
import BottomNav from '@/components/BottomNav'
import StoryBar from '@/components/StoryBar'
import StoryViewer from '@/components/StoryViewer'
import type { StoryGroup } from '@/lib/storiesApi'

export default function Status() {
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; startIndex: number } | null>(null)

  return (
    <div className="min-h-screen pb-24">
      <TopBar title="Statut" />
      <main className="mx-auto max-w-md px-5 pt-6">
        <StoryBar onOpenGroup={(groups, startIndex) => setViewer({ groups, startIndex })} />
      </main>
      <BottomNav />
      {viewer && (
        <StoryViewer
          groups={viewer.groups}
          startGroupIndex={viewer.startIndex}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  )
                                                                                            }

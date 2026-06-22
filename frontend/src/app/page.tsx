import { SplitLayout, LeftPanel } from '@/components/layout'
import { MapPlaceholder } from '@/components/map/MapPlaceholder'
import { MetricCards } from '@/components/metrics/MetricCards'
import { AgentPanel } from '@/components/agent/AgentPanel'

export default function Home() {
  return (
    <SplitLayout
      left={
        <LeftPanel>
          <MapPlaceholder />
          <MetricCards />
        </LeftPanel>
      }
      right={<AgentPanel />}
    />
  )
}

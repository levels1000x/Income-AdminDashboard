'use client'
import dynamic from 'next/dynamic'
import { PortalTheme } from './ui'
import { PortalErrorBoundary, WorkspaceLoading } from './fallbacks'
const IncomePortal = dynamic(() => import('./IncomePortal'), { ssr: false, loading: () => <WorkspaceLoading /> })
export default function PortalEntry() {
  return <PortalTheme><PortalErrorBoundary scope="workspace"><IncomePortal /></PortalErrorBoundary></PortalTheme>
}

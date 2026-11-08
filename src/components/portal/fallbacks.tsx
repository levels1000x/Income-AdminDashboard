import { Component, useEffect, useState, type ReactNode } from "react"
import { Alert, Box, Button, Skeleton, Stack, Typography } from "@mui/material"
import { CircleAlert } from "lucide-react"
const incomeWordmark = "/brand/income-wordmark-light.svg"
import { wordmarkMarkup } from "./wordmark"

// The exact supplied artwork, embedded in the JS bundle: no second asset request.
const embeddedWordmark = `data:image/svg+xml,${encodeURIComponent(wordmarkMarkup)}`

export function IncomeWordmark({ className }: { className?: string }) {
  const [fallback, setFallback] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  if (unavailable)
    return (
      <Typography component="span" className={className} aria-label="Income">
        Income
      </Typography>
    )
  return (
    <Box
      component="img"
      className={className}
      src={fallback ? embeddedWordmark : incomeWordmark}
      alt="Income"
      onError={() => {
        if (fallback) setUnavailable(true)
        else setFallback(true)
      }}
    />
  )
}

export function WorkspaceLoading() {
  return (
    <Box role="status" aria-live="polite" aria-busy="true">
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="rounded" className="ip-loading-panel" />
      <Typography variant="body2" color="text.secondary">
        Loading workspace…
      </Typography>
    </Box>
  )
}

export function ConnectionNotice() {
  const [offline, setOffline] = useState(() => !navigator.onLine)
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])
  if (!offline) return null
  return (
    <Alert severity="warning" className="ip-connection-notice">
      You’re offline. Loaded preview pages still work; unopened pages may be
      unavailable. Saving requires a connection. Unsaved edits are not synced.
    </Alert>
  )
}

type BoundaryProps = {
  children: ReactNode
  scope: "workspace" | "page"
  onOverview?: () => void
}

export class PortalErrorBoundary extends Component<BoundaryProps, {
  failed: boolean
}> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    const global = this.props.scope === "workspace"
    return (
      <Box className={global ? "income-workspace ip-global-error" : "ip-panel"}>
        <Box className="ip-empty" role="alert">
          <Box className="ip-empty-icon">
            <CircleAlert size={22} aria-hidden="true" />
          </Box>
          <Typography variant="h2" component="h1">
            {global ? "Workspace unavailable" : "This page couldn’t load"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {global
              ? "The preview encountered a problem. Reload to start a new preview session."
              : "Your session is still open. Try this page again, return to Overview, or reload if the problem continues."}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Saved records are safe. Unsaved edits will be lost when you reload.
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            justifyContent="center"
          >
            {!global && (
              <Button
                variant="outlined"
                onClick={() => this.setState({ failed: false })}
              >
                Try again
              </Button>
            )}
            {this.props.onOverview && (
              <Button variant="outlined" onClick={this.props.onOverview}>
                Return to Overview
              </Button>
            )}
            <Button
              variant="contained"
              onClick={() => {
                if (
                  window.confirm(
                    "Reload the workspace? Unsaved edits will be lost.",
                  )
                )
                  window.location.reload()
              }}
            >
              Reload preview
            </Button>
          </Stack>
        </Box>
      </Box>
    )
  }
}

'use client'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Eye, EyeOff } from 'lucide-react'
import { IncomeWordmark } from './fallbacks'
import { PortalTheme } from './ui'
export function AccessScreen({
  reset = false,
  onSuccess,
}: {
  reset?: boolean
  onSuccess?: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const submitting = useRef(false)
  const cleanEmail = email.trim()
  const emailProblem = !cleanEmail
    ? 'Enter your email address.'
    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
      ? ''
      : 'Enter a valid email address.'
  const passwordProblem = !password
    ? 'Enter your password.'
    : password.length < 12
      ? 'Use at least 12 characters.'
      : ''
  const emailError = attempted && !reset ? emailProblem : ''
  const passwordError = attempted ? passwordProblem : ''

  useEffect(() => {
    if (error) feedback.current?.focus()
  }, [error])
  useEffect(() => {
    if (success) heading.current?.focus()
  }, [success])

  return (
    <PortalTheme>
      <Box component="main" className="grid min-h-dvh place-items-center px-6 py-12">
        <Box component="section" aria-labelledby="access-title" className="w-full max-w-sm">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            className="mb-10"
          >
            <IncomeWordmark className="block h-6 w-24 object-contain object-left" />
            <Typography
              variant="caption"
              color="text.secondary"
              className="uppercase tracking-widest"
            >
              Administration
            </Typography>
          </Stack>
          <Box className="mb-6">
            <Typography
              id="access-title"
              component="h1"
              variant="h2"
              className="!text-xl"
              ref={heading}
              tabIndex={-1}
            >
              {success ? 'Password set' : reset ? 'Set your password' : 'Sign in to Income'}
            </Typography>
            <Typography variant="body2" color="text.secondary" className="!mt-2">
              {success
                ? 'Your staff account is ready. Sign in to continue.'
                : reset
                  ? 'Create a password for your staff account.'
                  : 'Enter your staff credentials.'}
            </Typography>
          </Box>
          {success ? (
            <Button href="/" variant="contained" fullWidth className="!min-h-11">
              Continue to sign in
            </Button>
          ) : (
            <Box
              component="form"
              noValidate
              aria-busy={busy}
              onSubmit={async (e) => {
                e.preventDefault()
                if (submitting.current) return
                setAttempted(true)
                setError('')
                if (!reset && emailProblem) {
                  emailInput.current?.focus()
                  return
                }
                if (passwordProblem) {
                  passwordInput.current?.focus()
                  return
                }
                const token = reset ? new URLSearchParams(location.search).get('token') : null
                if (reset && !token) {
                  setError(
                    'This invitation link is incomplete. Ask your administrator for a new invitation.',
                  )
                  return
                }
                submitting.current = true
                setBusy(true)
                try {
                  const response = await fetch('/api/portal-auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(
                      reset
                        ? {
                            action: 'accept',
                            token,
                            password,
                          }
                        : { action: 'login', email: cleanEmail, password },
                    ),
                  })
                  const result = await response.json().catch(() => null)
                  if (!response.ok || !result?.ok) {
                    setError(
                      reset
                        ? 'This invitation could not be accepted. It may have expired or already been used. Ask your administrator for a new invitation.'
                        : 'We couldn’t sign you in. Check your email and password, then try again.',
                    )
                    return
                  }
                  if (reset) {
                    setPassword('')
                    setSuccess(true)
                  } else onSuccess?.()
                } catch {
                  setError('Couldn’t connect to Income. Check your connection and try again.')
                } finally {
                  submitting.current = false
                  setBusy(false)
                }
              }}
            >
              <Stack spacing={2.5}>
                {error && (
                  <Alert severity="error" ref={feedback} tabIndex={-1}>
                    {error}
                  </Alert>
                )}
                {!reset && (
                  <Stack spacing={1}>
                    <Typography component="label" htmlFor="access-email" variant="body2">
                      Email address
                    </Typography>
                    <TextField
                      id="access-email"
                      name="email"
                      inputRef={emailInput}
                      autoComplete="email"
                      type="email"
                      required
                      disabled={busy}
                      value={email}
                      error={Boolean(emailError)}
                      helperText={emailError || undefined}
                      slotProps={{
                        htmlInput: {
                          autoCapitalize: 'none',
                          autoCorrect: 'off',
                          spellCheck: false,
                          inputMode: 'email',
                        },
                      }}
                      className="[&_.MuiInputBase-root]:min-h-11"
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setError('')
                      }}
                    />
                  </Stack>
                )}
                <Stack spacing={1}>
                  <Typography component="label" htmlFor="access-password" variant="body2">
                    {reset ? 'New password' : 'Password'}
                  </Typography>
                  <TextField
                    id="access-password"
                    name="password"
                    inputRef={passwordInput}
                    type={visible ? 'text' : 'password'}
                    required
                    disabled={busy}
                    value={password}
                    error={Boolean(passwordError)}
                    className="[&_.MuiInputBase-root]:min-h-11"
                    autoComplete={reset ? 'new-password' : 'current-password'}
                    slotProps={{
                      htmlInput: { minLength: 12, maxLength: 128 },
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              type="button"
                              edge="end"
                              aria-label={visible ? 'Hide password' : 'Show password'}
                              aria-pressed={visible}
                              aria-controls="access-password"
                              disabled={busy}
                              className="!h-11 !w-11"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setVisible((value) => !value)}
                            >
                              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                    onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                    onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                    onBlur={() => setCapsLock(false)}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    helperText={
                      passwordError ||
                      (capsLock
                        ? 'Caps Lock is on.'
                        : reset
                          ? 'Use at least 12 characters.'
                          : undefined)
                    }
                  />
                </Stack>
                <Button
                  variant="contained"
                  type="submit"
                  disabled={busy || success}
                  className="!min-h-11"
                >
                  {busy
                    ? reset
                      ? 'Setting password…'
                      : 'Signing in…'
                    : reset
                      ? 'Set password'
                      : 'Sign in'}
                </Button>
                <Box role="status" aria-live="polite" className="sr-only">
                  {busy ? (reset ? 'Setting your password.' : 'Signing in.') : ''}
                </Box>
              </Stack>
            </Box>
          )}
          {!success && (
            <>
              <Divider className="!my-6" />
              <Button href={reset ? '/' : '/admin'} variant="text" fullWidth className="!min-h-11">
                {reset ? 'Back to sign in' : 'Use administrator sign-in'}
              </Button>
              {!reset && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  align="center"
                  className="!mt-3 !block"
                >
                  Need access? Contact your administrator.
                </Typography>
              )}
            </>
          )}
        </Box>
      </Box>
    </PortalTheme>
  )
}

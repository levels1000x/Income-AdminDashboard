import { type ReactNode } from "react"
import {
  createTheme,
  ThemeProvider,
  CssBaseline,
  Box,
  Typography,
  Button,
  Chip,
  TextField,
  MenuItem,
} from "@mui/material"
import { ArrowRight, ChevronRight, Inbox } from "lucide-react"
import { statusTone } from "./status"

const statusColors = {
  neutral: { text: "#a7a7a7", bg: "#202020", line: "#2a2a2a" },
  success: { text: "#92cbae", bg: "#18271f", line: "#30483a" },
  attention: { text: "#e0ba78", bg: "#2a241a", line: "#50412a" },
  info: { text: "#98bce6", bg: "#1b2531", line: "#32455d" },
  source: { text: "#baa8df", bg: "#25202f", line: "#453954" },
  danger: { text: "#e4a0a0", bg: "#301e20", line: "#593638" },
} as const

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#f2f0eb", contrastText: "#0a0a0a" },
    background: { default: "#0a0a0a", paper: "#141414" },
    text: { primary: "#f2f0eb", secondary: "#a7a7a7" },
    divider: "#2a2a2a",
    success: { main: statusColors.success.text },
    warning: { main: statusColors.attention.text },
    info: { main: statusColors.info.text },
    error: { main: statusColors.danger.text },
    secondary: { main: statusColors.source.text },
  },
  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: 14,
    h1: {
      fontSize: "1.875rem",
      fontWeight: 500,
      letterSpacing: "-0.035em",
      lineHeight: 1.25,
    },
    h2: { fontSize: "1rem", fontWeight: 500, letterSpacing: "-0.025em" },
    h3: { fontSize: "0.875rem", fontWeight: 500 },
    body1: { fontSize: "0.875rem", lineHeight: 1.6 },
    body2: {
      fontSize: "0.8125rem",
      lineHeight: 1.6,
      letterSpacing: "-0.005em",
    },
    caption: { fontSize: "0.75rem", lineHeight: 1.5 },
    button: { fontSize: "0.8125rem", fontWeight: 500, textTransform: "none" },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 36,
          paddingInline: 14,
          gap: 6,
          borderRadius: 6,
          whiteSpace: "nowrap",
        },
        outlined: { borderColor: "#333333", color: "#f2f0eb" },
        text: { color: "#a7a7a7" },
        startIcon: { marginRight: 0 },
        endIcon: { marginLeft: 0 },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 6, color: "#a7a7a7" } },
    },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: "0.8125rem" } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { fontSize: "0.8rem", background: "#171717" },
        notchedOutline: { borderColor: "#333333" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          height: 24,
          fontSize: "0.71875rem",
          fontWeight: 500,
          letterSpacing: "0.005em",
          lineHeight: 1.3,
          background: "#222222",
          color: "#d3d3d3",
        },
        label: { paddingInline: 9 },
      },
    },
    MuiDialog: { styleOverrides: { paper: { backgroundImage: "none" } } },
    MuiDrawer: { styleOverrides: { paper: { backgroundImage: "none" } } },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", minHeight: 48, fontSize: "0.8rem" },
      },
    },
    MuiTabs: { styleOverrides: { indicator: { height: 2 } } },
    MuiMenuItem: {
      styleOverrides: { root: { minHeight: 36, fontSize: "0.8125rem" } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { fontSize: "0.71875rem", lineHeight: 1.5 } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: 20, gap: 8 } },
    },
    MuiCssBaseline: {
      styleOverrides: {
        ":root": Object.fromEntries(
          Object.entries(statusColors).flatMap(([tone, colors]) => [
            [`--ip-${tone}`, colors.text],
            [`--ip-${tone}-bg`, colors.bg],
            [`--ip-${tone}-line`, colors.line],
          ]),
        ),
        body: {
          fontFeatureSettings: '"ss01", "cv11"',
          fontVariantNumeric: "tabular-nums",
        },
      },
    },
  },
})
export function PortalTheme({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
export function Heading({
  children,
  level = 2,
}: {
  children: ReactNode
  level?: 1 | 2 | 3
}) {
  return <Typography variant={`h${level}`}>{children}</Typography>
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <Box className="ip-page-title">
      <Box>
        {eyebrow && <Typography className="ip-eyebrow">{eyebrow}</Typography>}
        <Heading level={1}>{title}</Heading>
        <Typography className="ip-page-description">{description}</Typography>
      </Box>
      {children && <Box className="ip-page-title-actions">{children}</Box>}
    </Box>
  )
}
export function Status({
  label,
  subtle = false,
}: {
  label: string
  subtle?: boolean
}) {
  return (
    <Chip
      size="small"
      className={`ip-status ${subtle ? "is-subtle" : ""}`}
      data-tone={statusTone(label)}
      icon={<Box component="span" className="ip-status-dot" />}
      label={label}
    />
  )
}
export function SectionHeader({
  title,
  count,
  action,
  onAction,
}: {
  title: string
  count?: number
  action?: string
  onAction?: () => void
}) {
  return (
    <Box className="ip-section-header">
      <Box className="ip-inline">
        <Heading>{title}</Heading>
        {count !== undefined && <Box className="ip-count">{count}</Box>}
      </Box>
      {action && (
        <Button
          size="small"
          endIcon={<ArrowRight size={14} />}
          onClick={onAction}
        >
          {action}
        </Button>
      )}
    </Box>
  )
}
export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <MenuItem value={option} key={option}>
          {option}
        </MenuItem>
      ))}
    </TextField>
  )
}
export function EmptyState({
  title = "No matching records",
  description = "Try another search or adjust your filters.",
  onReset,
}: {
  title?: string
  description?: string
  onReset?: () => void
}) {
  return (
    <Box className="ip-empty">
      <Box className="ip-empty-icon">
        <Inbox size={22} />
      </Box>
      <Heading>{title}</Heading>
      <Typography color="text.secondary" variant="body2">
        {description}
      </Typography>
      {onReset && (
        <Button variant="outlined" onClick={onReset}>
          Clear filters
        </Button>
      )}
    </Box>
  )
}
export function RowArrow() {
  return <ChevronRight size={16} className="ip-row-arrow" aria-hidden="true" />
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Snackbar,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";

import { Button } from "@/components/ui";

type U = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  customerId: string;
  customerName: string;
  createdAt: string;
};

const send = (m: string, u: string, b: unknown) =>
  fetch(u, {
    method: m,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(b),
  });

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "SUPPORT", "ACCOUNTS", "SALES"];

export default function Users() {
  const [users, setUsers] = useState<U[]>([]);
  const [custs, setCusts] = useState<Record<string, string>[]>([]);

  const [me, setMe] = useState<{
    id: string;
    role: string;
  } | null>(null);

  const [tab, setTab] = useState(0);

  const [open, setOpen] = useState(false);

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [forbidden, setForbidden] = useState(false);

  const [f, setF] = useState({
    name: "",
    email: "",
    password: "",
    role: "SUPPORT",
    customerId: "",
  });

  const [reset, setReset] = useState<U | null>(null);
  const [pw, setPw] = useState("");

  // ============================================================
  // TEST NOTIFICATION STATE
  // ============================================================

  const [notificationUser, setNotificationUser] = useState<U | null>(null);

  const [notificationTitle, setNotificationTitle] =
    useState("Test Notification");

  const [notificationMessage, setNotificationMessage] = useState(
    "This is a test notification from Velvotix.",
  );

  const [sendingNotification, setSendingNotification] = useState(false);

  // ============================================================
  // LOAD USERS
  // ============================================================

  const loadUsers = useCallback(async () => {
    const r = await fetch("/api/users?manage=1");

    if (r.status === 403) {
      setForbidden(true);
    } else if (r.ok) {
      setUsers((await r.json()).rows);
    } else {
      setMsg("Unable to load users.");
    }
  }, []);

  useEffect(() => {
    loadUsers();

    fetch("/api/auth/me").then(async (r) => {
      if (r.ok) {
        setMe(await r.json());
      }
    });

    fetch("/api/customers?pageSize=100").then(async (r) => {
      if (r.ok) {
        setCusts((await r.json()).rows);
      }
    });
  }, [loadUsers]);

  // ============================================================
  // FILTERS
  // ============================================================

  const isCust = tab === 1;

  const shown = useMemo(
    () => users.filter((u) => (u.role === "CUSTOMER") === isCust),
    [users, isCust],
  );

  const roles =
    me?.role === "SUPER_ADMIN"
      ? STAFF_ROLES
      : STAFF_ROLES.filter((r) => r !== "SUPER_ADMIN");

  // Existing edit permission.
  // IMPORTANT:
  // This remains unchanged so self-edit restrictions
  // continue to work as before.
  const canEdit = (u: U) =>
    !!me &&
    u.id !== me.id &&
    (me.role === "SUPER_ADMIN" || u.role !== "SUPER_ADMIN");

  // ============================================================
  // CREATE USER
  // ============================================================

  const openNew = () => {
    setF({
      name: "",
      email: "",
      password: "",
      role: isCust ? "CUSTOMER" : "SUPPORT",
      customerId: "",
    });

    setErr("");
    setOpen(true);
  };

  const create = async () => {
    const res = await send("POST", "/api/users", {
      ...f,
      customerId: f.role === "CUSTOMER" ? f.customerId : undefined,
    });

    if (res.ok) {
      setOpen(false);
      setMsg("User created.");
      loadUsers();
    } else {
      const j = await res.json().catch(() => ({}));

      setErr(
        j.issues?.[0]?.message || j.message || "User could not be created.",
      );
    }
  };

  // ============================================================
  // ENABLE / DISABLE USER
  // ============================================================

  const toggle = async (u: U) => {
    setUsers((x) =>
      x.map((r) =>
        r.id === u.id
          ? {
              ...r,
              active: !u.active,
            }
          : r,
      ),
    );

    const res = await send("PUT", `/api/users/${u.id}`, {
      active: !u.active,
    });

    if (!res.ok) {
      setMsg((await res.json().catch(() => ({}))).message || "Update failed.");

      loadUsers();
    } else {
      setMsg(`${u.name} ${u.active ? "disabled" : "enabled"}.`);
    }
  };

  // ============================================================
  // CHANGE ROLE
  // ============================================================

  const setRole = async (u: U, role: string) => {
    const res = await send("PUT", `/api/users/${u.id}`, {
      role,
    });

    if (res.ok) {
      setUsers((x) =>
        x.map((r) =>
          r.id === u.id
            ? {
                ...r,
                role,
              }
            : r,
        ),
      );
    } else {
      setMsg(
        (await res.json().catch(() => ({}))).message || "Role change failed.",
      );
    }
  };

  // ============================================================
  // RESET PASSWORD
  // ============================================================

  const doReset = async () => {
    const res = await send("PUT", `/api/users/${reset!.id}`, {
      password: pw,
    });

    setMsg(
      res.ok
        ? "Password reset."
        : (await res.json().catch(() => ({}))).issues?.[0]?.message ||
            "Reset failed.",
    );

    if (res.ok) {
      setReset(null);
      setPw("");
    }
  };

  // ============================================================
  // SEND TEST PUSH NOTIFICATION
  // ============================================================

  const sendTestNotification = async () => {
    if (!notificationUser) {
      return;
    }

    if (!notificationTitle.trim()) {
      setMsg("Notification title is required.");
      return;
    }

    if (!notificationMessage.trim()) {
      setMsg("Notification message is required.");
      return;
    }

    setSendingNotification(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/push-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: notificationUser.id,
          title: notificationTitle.trim(),
          message: notificationMessage.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(data.message || "Unable to send notification.");

        return;
      }

      setMsg(
        data.message || `Test notification sent to ${notificationUser.name}.`,
      );

      setNotificationUser(null);
    } catch (error) {
      console.error("Test notification error:", error);

      setMsg("Unable to send notification. Please try again.");
    } finally {
      setSendingNotification(false);
    }
  };

  // ============================================================
  // FORBIDDEN
  // ============================================================

  if (forbidden) {
    return (
      <Box p={3}>
        <Alert severity="warning">
          Only Admin and Super Admin can manage users.
        </Alert>
      </Box>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <Box
      sx={{
        p: 3,
        maxWidth: 1200,
        mx: "auto",
        display: "grid",
        gap: 2,
      }}
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <Box
        sx={{
          display: "flex",
          gap: 2,
          alignItems: "center",
        }}
      >
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>
          Users & Logins
        </Typography>

        <Button variant="contained" color="secondary" onClick={openNew}>
          {isCust ? "New customer login" : "New staff user"}
        </Button>
      </Box>

      {/* ======================================================
          TABS
      ====================================================== */}

      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab
          label={`Staff (${users.filter((u) => u.role !== "CUSTOMER").length})`}
        />

        <Tab
          label={`Customer logins (${
            users.filter((u) => u.role === "CUSTOMER").length
          })`}
        />
      </Tabs>

      {/* ======================================================
          USERS TABLE
      ====================================================== */}

      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {[
                "Name",
                "Email",
                isCust ? "Customer" : "Role",
                "Status",
                "Enabled",
                "",
              ].map((x) => (
                <TableCell key={x}>{x}</TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {shown.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell
                  sx={{
                    fontWeight: 600,
                  }}
                >
                  {u.name}
                </TableCell>

                <TableCell>{u.email}</TableCell>

                <TableCell>
                  {isCust ? (
                    u.customerName || u.customerId
                  ) : (
                    <TextField
                      select
                      size="small"
                      variant="standard"
                      value={u.role}
                      disabled={!canEdit(u)}
                      onChange={(e) => setRole(u, e.target.value)}
                    >
                      {(roles.includes(u.role)
                        ? roles
                        : [u.role, ...roles]
                      ).map((r) => (
                        <MenuItem key={r} value={r}>
                          {r}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </TableCell>

                <TableCell>
                  <Chip
                    size="small"
                    label={u.active ? "Active" : "Disabled"}
                    color={u.active ? "success" : "default"}
                  />
                </TableCell>

                <TableCell>
                  <Switch
                    checked={u.active}
                    disabled={!canEdit(u)}
                    onChange={() => toggle(u)}
                  />
                </TableCell>

                <TableCell>
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* ======================================
                        RESET PASSWORD
                        Existing permissions preserved
                    ====================================== */}

                    <Button
                      size="small"
                      disabled={!canEdit(u)}
                      onClick={() => {
                        setReset(u);
                        setPw("");
                      }}
                    >
                      Reset password
                    </Button>

                    {/* ======================================
                        TEST NOTIFICATION

                        IMPORTANT:
                        No canEdit(u) restriction here.

                        This means ADMIN can send a test
                        notification to THEMSELVES.
                    ====================================== */}

                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      startIcon={<NotificationsActiveIcon />}
                      disabled={!u.active}
                      onClick={() => {
                        setNotificationUser(u);

                        setNotificationTitle("Test Notification");

                        setNotificationMessage(
                          "This is a test notification from Velvotix.",
                        );
                      }}
                    >
                      Test Notification
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}

            {!shown.length && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  align="center"
                  sx={{
                    py: 4,
                    color: "text.secondary",
                  }}
                >
                  Nothing here yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* ======================================================
          NEW USER DIALOG
      ====================================================== */}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {isCust ? "New customer login" : "New staff user"}
        </DialogTitle>

        <DialogContent
          sx={{
            display: "grid",
            gap: 2,
            pt: "8px !important",
          }}
        >
          {err && <Alert severity="error">{err}</Alert>}

          <TextField
            label="Name"
            value={f.name}
            onChange={(e) =>
              setF({
                ...f,
                name: e.target.value,
              })
            }
          />

          <TextField
            label="Email (login)"
            value={f.email}
            onChange={(e) =>
              setF({
                ...f,
                email: e.target.value,
              })
            }
          />

          <TextField
            label="Temporary password"
            helperText="Minimum 8 characters"
            type="password"
            value={f.password}
            onChange={(e) =>
              setF({
                ...f,
                password: e.target.value,
              })
            }
          />

          {isCust ? (
            <TextField
              select
              label="Customer"
              value={f.customerId}
              onChange={(e) =>
                setF({
                  ...f,
                  customerId: e.target.value,
                })
              }
            >
              {custs.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.companyName}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              select
              label="Role"
              value={f.role}
              onChange={(e) =>
                setF({
                  ...f,
                  role: e.target.value,
                })
              }
            >
              {roles.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </TextField>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>

          <Button variant="contained" onClick={create}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* ======================================================
          RESET PASSWORD DIALOG
      ====================================================== */}

      <Dialog
        open={!!reset}
        onClose={() => setReset(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Reset password - {reset?.name}</DialogTitle>

        <DialogContent
          sx={{
            pt: "8px !important",
          }}
        >
          <TextField
            fullWidth
            label="New password"
            helperText="Minimum 8 characters"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setReset(null)}>Cancel</Button>

          <Button
            variant="contained"
            disabled={pw.length < 8}
            onClick={doReset}
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>

      {/* ======================================================
          TEST NOTIFICATION DIALOG
      ====================================================== */}

      <Dialog
        open={!!notificationUser}
        onClose={() => {
          if (!sendingNotification) {
            setNotificationUser(null);
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Send Test Notification</DialogTitle>

        <DialogContent
          sx={{
            display: "grid",
            gap: 2,
            pt: "8px !important",
          }}
        >
          <Alert severity="info">
            Send a real push notification to{" "}
            <strong>{notificationUser?.name}</strong>.
          </Alert>

          <TextField
            fullWidth
            label="Notification title"
            value={notificationTitle}
            onChange={(e) => setNotificationTitle(e.target.value)}
            disabled={sendingNotification}
          />

          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Notification message"
            value={notificationMessage}
            onChange={(e) => setNotificationMessage(e.target.value)}
            disabled={sendingNotification}
          />
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => setNotificationUser(null)}
            disabled={sendingNotification}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<NotificationsActiveIcon />}
            onClick={sendTestNotification}
            disabled={
              sendingNotification ||
              !notificationTitle.trim() ||
              !notificationMessage.trim()
            }
          >
            {sendingNotification ? "Sending..." : "Send Notification"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ======================================================
          MESSAGE
      ====================================================== */}

      <Snackbar
        open={!!msg}
        autoHideDuration={4000}
        onClose={() => setMsg("")}
        message={msg}
      />
    </Box>
  );
}

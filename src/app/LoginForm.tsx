"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Card,
  CardContent,
  IconButton,
  Link,
  TextField,
  Typography,
  Button,
  CircularProgress,
} from "@mui/material";
import Brightness4 from "@mui/icons-material/Brightness4";
import { useToggleMode } from "./providers";
import { InstallButton } from "@/components/PwaRegister";
import { homeFor } from "@/lib/roles";

export default function LoginForm({
  portal,
}: {
  portal: "admin" | "customer";
}) {
  const r = useRouter();
  const toggle = useToggleMode();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Check for an existing active session.
  useEffect(() => {
    let mounted = true;

    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok || !mounted) return;

        const u = await res.json();

        r.replace(homeFor(u.role));
      })
      .catch(() => {
        // No active session.
      });

    return () => {
      mounted = false;
    };
  }, [r]);

  const submit = async () => {
    if (busy) return;

    setErr("");
    setBusy(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          portal,
        }),
      });

      if (res.ok) {
        const me = await res.json().catch(() => ({}));

        r.push(homeFor(me?.role ?? (portal === "admin" ? "ADMIN" : "CUSTOMER")));

        // Keep busy state while navigating.
        return;
      }

      const data = await res.json().catch(() => ({}));

      setErr(
        typeof data?.message === "string" ? data.message : "Unable to sign in.",
      );

      setBusy(false);
    } catch {
      setErr("Unable to connect to the server.");
      setBusy(false);
    }
  };

  const otherHref: string = portal === "admin" ? "/" : "/admin/login";

  const otherLabel: string =
    portal === "admin" ? "Customer login" : "Velvotix staff login";

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        p: 2,
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 380,
        }}
      >
        <CardContent
          sx={{
            display: "grid",
            gap: 2,
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h5" color="primary" fontWeight={700}>
              Velvotix{" "}
              <span style={{ color: "#ef6c00" }}>
                {portal === "admin" ? "Admin" : "Support"}
              </span>
            </Typography>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
              }}
            >
              <InstallButton />

              <IconButton onClick={toggle} aria-label="toggle theme">
                <Brightness4 />
              </IconButton>
            </Box>
          </Box>

          {/* Error */}
          {err && <Alert severity="error">{err}</Alert>}

          {/* Email */}
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
          />

          {/* Password */}
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                submit();
              }
            }}
            fullWidth
          />

          {/* Login Button */}
          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={busy}
            onClick={submit}
          >
            {busy ? (
              <>
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>

          {/* Switch Portal */}
          <Link href={otherHref} underline="hover" variant="body2">
            {otherLabel}
          </Link>
        </CardContent>
      </Card>
    </Box>
  );
}

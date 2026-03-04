import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/use-auth";
import { useToast } from "../app/use-toast";
import { ErrorPanel } from "../components/ErrorPanel";
import { getLastRoute } from "../lib/prefs";
import { useMutation } from "../lib/query";
import { Button, Card, Input } from "../ui";

type LoginInput = {
  email: string;
  password: string;
};

export function LoginPage() {
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation<void, LoginInput>(async (vars) => {
    await auth.login(vars.email, vars.password);
  });

  useEffect(() => {
    if (auth.isAuthenticated) {
      const target = getLastRoute(auth.user?.email) ?? "/app";
      navigate(target, { replace: true });
    }
  }, [auth.isAuthenticated, auth.user?.email, navigate]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await loginMutation.mutate({ email, password });
      toast.pushToast("success", "Logged in successfully.");
      const from = (location.state as { from?: string } | null)?.from ?? getLastRoute(email) ?? "/app";
      navigate(from, { replace: true });
    } catch {
      toast.pushToast("error", "Login failed.");
    }
  }

  return (
    <div className="pageCentered">
      <Card className="loginPanel">
        <h1>Login</h1>
        <form onSubmit={onSubmit} className="form">
          <label>
            Email
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              required
            />
          </label>
          <label>
            Password
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              required
            />
          </label>
          <Button type="submit" disabled={loginMutation.isLoading}>
            {loginMutation.isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </Card>
      {loginMutation.error ? <ErrorPanel error={loginMutation.error} /> : null}
    </div>
  );
}


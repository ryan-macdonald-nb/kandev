import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessionGitPendingScope, useSessionGitStatus } from "./use-session-git-status";

const mocks = vi.hoisted(() => ({
  client: null as { subscribeSession: (sessionId: string) => () => void } | null,
  subscribeSession: vi.fn(() => vi.fn()),
  state: {
    connection: { status: "connected" },
    gitStatus: { byEnvironmentId: {} },
    environmentIdBySessionId: {} as Record<string, string>,
    sessionCommits: { refetchTrigger: {} as Record<string, number> },
  },
}));

vi.mock("@/components/state-provider", () => ({
  useAppStore: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}));

vi.mock("@/lib/ws/connection", () => ({
  getWebSocketClient: () => mocks.client,
  useWebSocketClient: () => mocks.client,
}));

describe("useSessionGitStatus subscription readiness", () => {
  afterEach(cleanup);

  it("subscribes when the client registers after the connected state", () => {
    mocks.client = null;
    mocks.subscribeSession.mockClear();
    const hook = renderHook(() => useSessionGitStatus("session-1"));
    expect(mocks.subscribeSession).not.toHaveBeenCalled();

    mocks.client = { subscribeSession: mocks.subscribeSession };
    hook.rerender();

    expect(mocks.subscribeSession).toHaveBeenCalledOnce();
    expect(mocks.subscribeSession).toHaveBeenCalledWith("session-1");
  });
});

describe("useSessionGitPendingScope", () => {
  afterEach(cleanup);

  // Reviewer-required contract coverage for the pending ownership boundary.
  it("changes across session and environment scopes but ignores commit refetches", () => {
    mocks.state.environmentIdBySessionId = { "session-1": "environment-1" };
    mocks.state.sessionCommits.refetchTrigger = { "environment-1": 0 };

    const hook = renderHook(({ sessionId }) => useSessionGitPendingScope(sessionId), {
      initialProps: { sessionId: "session-1" as string | null },
    });
    const initial = hook.result.current;

    hook.rerender({ sessionId: "session-2" });
    expect(hook.result.current).not.toBe(initial);

    mocks.state.environmentIdBySessionId["session-2"] = "environment-2";
    hook.rerender({ sessionId: "session-2" });
    const environmentScoped = hook.result.current;
    expect(environmentScoped).not.toBe(initial);

    mocks.state.sessionCommits.refetchTrigger["environment-2"] = 1;
    hook.rerender({ sessionId: "session-2" });
    expect(hook.result.current).toBe(environmentScoped);
  });
});

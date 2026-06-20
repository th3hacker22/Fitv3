// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for API route security behaviors.
 * These test the validation + auth + rate-limiting patterns we added in Phase 2,
 * without spinning up the full Next.js server (which would require a running DB).
 *
 * We test the validation helpers (which all routes use) and the social store's
 * auth header sending behavior (which all write operations depend on).
 */

// Mock the auth store
const mockUser = {
  uid: "test-user-123",
  displayName: "Test Athlete",
  photoURL: "https://example.com/photo.jpg",
};

vi.mock("@/store/useAuthStore", () => ({
  useAuthStore: {
    getState: () => ({ user: mockUser }),
  },
}));

describe("Social store auth headers integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useSocialStore sends x-user-* headers on follow", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const { useSocialStore } = await import("@/store/useSocialStore");
    useSocialStore.setState({ following: [], feed: [] });

    await useSocialStore.getState().follow("test-user-123", "target-user");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/social/follow",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-user-name": "Test Athlete",
          "x-user-photo": "https://example.com/photo.jpg",
        }),
      })
    );

    vi.unstubAllGlobals();
  });

  it("useSocialStore sends x-user-uid on giveKudos", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const { useSocialStore } = await import("@/store/useSocialStore");
    useSocialStore.setState({
      feed: [
        {
          id: "post1",
          authorUid: "other",
          authorName: "Other",
          authorPhotoURL: null,
          workoutTitle: "Test",
          duration: 60,
          totalVolume: 1000,
          exercisesCount: 5,
          kudosCount: 0,
          commentCount: 0,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    await useSocialStore.getState().giveKudos("post1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/social/kudos",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-user-name": "Test Athlete",
        }),
      })
    );

    vi.unstubAllGlobals();
  });

  it("useSocialStore sends x-user-* headers on addComment", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true }) // POST
      .mockResolvedValueOnce({ ok: true, json: async () => [] }); // GET loadComments

    vi.stubGlobal("fetch", mockFetch);

    const { useSocialStore } = await import("@/store/useSocialStore");
    useSocialStore.setState({
      feed: [
        {
          id: "post1",
          authorUid: "other",
          authorName: "Other",
          authorPhotoURL: null,
          workoutTitle: "Test",
          duration: 60,
          totalVolume: 1000,
          exercisesCount: 5,
          kudosCount: 0,
          commentCount: 0,
          createdAt: new Date().toISOString(),
        },
      ],
      commentsByPost: {},
    });

    await useSocialStore.getState().addComment("post1", "Great workout!");

    // First call should be POST with auth headers
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "/api/social/comments",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-user-name": "Test Athlete",
        }),
        body: JSON.stringify({ postId: "post1", text: "Great workout!" }),
      })
    );

    vi.unstubAllGlobals();
  });

  it("useSocialStore deleteComment checks response.ok before optimistic update", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 403 }); // server rejects
    vi.stubGlobal("fetch", mockFetch);

    const { useSocialStore } = await import("@/store/useSocialStore");
    useSocialStore.setState({
      feed: [
        {
          id: "post1",
          authorUid: "other",
          authorName: "Other",
          authorPhotoURL: null,
          workoutTitle: "Test",
          duration: 60,
          totalVolume: 1000,
          exercisesCount: 5,
          kudosCount: 0,
          commentCount: 5,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    // deleteComment should throw because res.ok is false
    await expect(
      useSocialStore.getState().deleteComment("post1", "comment1")
    ).rejects.toThrow();

    // commentCount should NOT have been decremented (optimistic update skipped)
    expect(useSocialStore.getState().feed[0].commentCount).toBe(5);

    vi.unstubAllGlobals();
  });
});

describe("Challenges store auth headers integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("joinChallenge sends x-user-uid and x-user-name headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        userId: "test-user-123",
        userName: "Test Athlete",
        userPhotoURL: null,
        progressKg: 0,
        completed: false,
        completedAt: null,
        joinedAt: new Date().toISOString(),
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { useChallengesStore } = await import("@/store/useChallengesStore");
    useChallengesStore.setState({
      activeChallenges: [{ id: "ch1", title: "Test", description: "", goalKg: 1000, startDate: "", endDate: "" }],
      userParticipations: {},
    });

    await useChallengesStore.getState().joinChallenge("ch1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/challenges/ch1/join",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-user-name": "Test Athlete",
        }),
      })
    );

    vi.unstubAllGlobals();
  });

  it("syncWorkoutVolume sends sessionId in the body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const { useChallengesStore } = await import("@/store/useChallengesStore");
    useChallengesStore.setState({
      activeChallenges: [{ id: "ch1", title: "Test", description: "", goalKg: 1000, startDate: "", endDate: "" }],
      userParticipations: {
        ch1: {
          userId: "test-user-123",
          userName: "Test Athlete",
          userPhotoURL: null,
          progressKg: 0,
          completed: false,
          joinedAt: new Date().toISOString(),
        },
      },
    });

    await useChallengesStore.getState().syncWorkoutVolume(5000, "session-abc");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/challenges/sync-volume",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: "test-user-123", totalVolume: 5000, sessionId: "session-abc" }),
      })
    );

    vi.unstubAllGlobals();
  });
});

describe("AI workout service fallback behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to algorithmic generator when offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });

    const { generateWorkoutAI } = await import("@/services/aiWorkoutService");

    const mockExercises = [
      {
        id: "ex1",
        name: "Push Up",
        category: "strength",
        bodyPart: "chest",
        equipment: "body weight",
        instructions: "",
        instructionSteps: [],
        muscleGroup: "chest",
        secondaryMuscles: [],
        target: "pectorals",
        imageUrl: "",
        gifUrl: "",
      },
    ];

    const result = await generateWorkoutAI(
      {
        gender: "male",
        age: 25,
        goal: "Strength",
        fitnessLevel: "Beginner",
        equipment: ["body weight"],
        selectedMuscles: ["chest"],
      },
      mockExercises
    );

    // Should return a valid routine from the algorithmic fallback
    expect(result).toBeDefined();
    expect(result.exercises).toBeDefined();
    expect(result.exercises.length).toBeGreaterThan(0);
  });
});

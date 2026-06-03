import { generateBalancedTeams, getAlgorithmPackageStatus } from "./index";

const players = [
  { playerId: "ply_1", rating: 88, preferredStyle: "attacker" },
  { playerId: "ply_2", rating: 83, preferredStyle: "goalkeeper" },
  { playerId: "ply_3", rating: 81, preferredStyle: "defender" },
  { playerId: "ply_4", rating: 79, preferredStyle: "midfielder" },
  { playerId: "ply_5", rating: 76, preferredStyle: "attacker" },
  { playerId: "ply_6", rating: 74, preferredStyle: "goalkeeper" },
  { playerId: "ply_7", rating: 71, preferredStyle: "defender" },
  { playerId: "ply_8", rating: 69, preferredStyle: "midfielder" },
  { playerId: "ply_9", rating: 66, preferredStyle: "all_rounder" },
  { playerId: "ply_10", rating: 62, preferredStyle: "attacker" },
];

describe("getAlgorithmPackageStatus", () => {
  it("confirms the algorithm package test runner is wired", () => {
    expect(getAlgorithmPackageStatus()).toEqual({
      key: "team-generator",
      status: "ready",
    });
  });
});

describe("generateBalancedTeams", () => {
  it("generates deterministic fair teams from a confirmed pool", () => {
    const result = generateBalancedTeams({
      players,
      playersPerTeam: 5,
      seed: "match_123:1",
      style: "max_fairness",
      goalkeeperMode: "fixed_goalkeeper",
    });

    expect(result.teamA.players).toHaveLength(5);
    expect(result.teamB.players).toHaveLength(5);
    expect(result.fairnessPercentage).toBeGreaterThanOrEqual(90);
    expect(result.scoreComponents.ratingGap).toBeLessThanOrEqual(2);
    expect(
      result.teamA.players.map((player) => player.playerId).sort()
    ).toEqual(["ply_1", "ply_3", "ply_6", "ply_8", "ply_10"].sort());
  });

  it("keeps the same split for the same seed", () => {
    const firstResult = generateBalancedTeams({
      players,
      playersPerTeam: 5,
      seed: "same-seed",
      style: "fair_fresh",
      goalkeeperMode: "rotating_goalkeeper",
    });
    const secondResult = generateBalancedTeams({
      players,
      playersPerTeam: 5,
      seed: "same-seed",
      style: "fair_fresh",
      goalkeeperMode: "rotating_goalkeeper",
    });

    expect(secondResult.teamA.players).toEqual(firstResult.teamA.players);
    expect(secondResult.teamB.players).toEqual(firstResult.teamB.players);
  });

  it("rejects a pool that does not match the requested format", () => {
    expect(() =>
      generateBalancedTeams({
        players: players.slice(0, 9),
        playersPerTeam: 5,
        seed: "bad-pool",
        style: "fair_fresh",
        goalkeeperMode: "fixed_goalkeeper",
      })
    ).toThrow("Confirmed player pool must match the requested format.");
  });
});

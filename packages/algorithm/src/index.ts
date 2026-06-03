export const TEAM_GENERATOR_ALGORITHM_VERSION = "team-generator-v1";

export type AlgorithmPackageStatus = {
  key: "team-generator";
  status: "ready";
};

export type TeamGeneratorStyle = "fair_fresh" | "max_fairness" | "more_variety";
export type TeamGeneratorGoalkeeperMode =
  | "fixed_goalkeeper"
  | "rotating_goalkeeper"
  | "no_goalkeeper";

export type TeamGeneratorPlayer = {
  playerId: string;
  rating: number;
  preferredStyle: string | null;
};

export type TeamGeneratorInput = {
  players: TeamGeneratorPlayer[];
  playersPerTeam: number;
  seed: string;
  style: TeamGeneratorStyle;
  goalkeeperMode: TeamGeneratorGoalkeeperMode;
};

export type GeneratedTeamPlayer = TeamGeneratorPlayer & {
  slot: number;
};

export type GeneratedTeam = {
  label: "A" | "B";
  totalRating: number;
  averageRating: number;
  players: GeneratedTeamPlayer[];
};

export type TeamGenerationScoreComponents = {
  ratingGap: number;
  positionImbalance: number;
  goalkeeperImbalance: number;
  randomness: number;
  candidateScore: number;
};

export type TeamGenerationExplanation = {
  summary: string;
  bullets: string[];
};

export type TeamGenerationResult = {
  algorithmVersion: typeof TEAM_GENERATOR_ALGORITHM_VERSION;
  seed: string;
  teamA: GeneratedTeam;
  teamB: GeneratedTeam;
  fairnessPercentage: number;
  scoreComponents: TeamGenerationScoreComponents;
  explanation: TeamGenerationExplanation;
};

type CandidateScore = {
  teamA: GeneratedTeamPlayer[];
  teamB: GeneratedTeamPlayer[];
  scoreComponents: TeamGenerationScoreComponents;
  fairnessPercentage: number;
};

const STYLE_WEIGHTS = {
  fair_fresh: {
    rating: 10,
    position: 1.75,
    goalkeeper: 8,
    randomness: 0.35,
  },
  max_fairness: {
    rating: 14,
    position: 1.25,
    goalkeeper: 9,
    randomness: 0.1,
  },
  more_variety: {
    rating: 8,
    position: 1.5,
    goalkeeper: 7,
    randomness: 1.2,
  },
} as const satisfies Record<
  TeamGeneratorStyle,
  {
    rating: number;
    position: number;
    goalkeeper: number;
    randomness: number;
  }
>;

export function getAlgorithmPackageStatus(): AlgorithmPackageStatus {
  return {
    key: "team-generator",
    status: "ready",
  };
}

export function generateBalancedTeams(
  input: TeamGeneratorInput
): TeamGenerationResult {
  if (input.players.length !== input.playersPerTeam * 2) {
    throw new Error("Confirmed player pool must match the requested format.");
  }

  const normalizedPlayers = input.players.map((player, index) => ({
    ...player,
    rating: clampRating(player.rating),
    slot: index + 1,
  }));
  const firstPlayerIndex = 0;
  const restIndexes = normalizedPlayers.slice(1).map((_, index) => index + 1);
  let bestCandidate: CandidateScore | null = null;
  let candidateIndex = 0;

  for (const combination of combinations(
    restIndexes,
    input.playersPerTeam - 1
  )) {
    const teamAIndexes = new Set([firstPlayerIndex, ...combination]);
    const teamA = normalizedPlayers.filter((_, index) =>
      teamAIndexes.has(index)
    );
    const teamB = normalizedPlayers.filter(
      (_, index) => !teamAIndexes.has(index)
    );
    const candidate = scoreCandidate(teamA, teamB, input, candidateIndex);

    if (
      !bestCandidate ||
      candidate.scoreComponents.candidateScore <
        bestCandidate.scoreComponents.candidateScore
    ) {
      bestCandidate = candidate;
    }

    candidateIndex += 1;
  }

  if (!bestCandidate) {
    throw new Error("Unable to create a team split.");
  }

  const teamA = toGeneratedTeam("A", bestCandidate.teamA);
  const teamB = toGeneratedTeam("B", bestCandidate.teamB);

  return {
    algorithmVersion: TEAM_GENERATOR_ALGORITHM_VERSION,
    seed: input.seed,
    teamA,
    teamB,
    fairnessPercentage: bestCandidate.fairnessPercentage,
    scoreComponents: bestCandidate.scoreComponents,
    explanation: buildExplanation(teamA, teamB, bestCandidate.scoreComponents),
  };
}

function scoreCandidate(
  teamA: GeneratedTeamPlayer[],
  teamB: GeneratedTeamPlayer[],
  input: TeamGeneratorInput,
  candidateIndex: number
): CandidateScore {
  const weights = STYLE_WEIGHTS[input.style];
  const teamAAverage = getAverageRating(teamA);
  const teamBAverage = getAverageRating(teamB);
  const ratingGap = roundToOneDecimal(Math.abs(teamAAverage - teamBAverage));
  const positionImbalance = getPositionImbalance(teamA, teamB);
  const goalkeeperImbalance = getGoalkeeperImbalance(
    teamA,
    teamB,
    input.goalkeeperMode
  );
  const randomness =
    hashToUnitInterval(`${input.seed}:${candidateIndex}`) * weights.randomness;
  const candidateScore = roundToThreeDecimals(
    ratingGap * weights.rating +
      positionImbalance * weights.position +
      goalkeeperImbalance * weights.goalkeeper +
      randomness
  );
  const fairnessPercentage = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 - ratingGap * 5 - positionImbalance * 1.5 - goalkeeperImbalance * 5
      )
    )
  );

  return {
    teamA,
    teamB,
    fairnessPercentage,
    scoreComponents: {
      ratingGap,
      positionImbalance,
      goalkeeperImbalance,
      randomness: roundToThreeDecimals(randomness),
      candidateScore,
    },
  };
}

function* combinations<TValue>(
  values: TValue[],
  size: number,
  startIndex = 0,
  prefix: TValue[] = []
): Generator<TValue[]> {
  if (prefix.length === size) {
    yield prefix;
    return;
  }

  for (
    let index = startIndex;
    index <= values.length - (size - prefix.length);
    index += 1
  ) {
    yield* combinations(values, size, index + 1, [...prefix, values[index]]);
  }
}

function getAverageRating(players: TeamGeneratorPlayer[]) {
  return (
    players.reduce((total, player) => total + player.rating, 0) / players.length
  );
}

function getTotalRating(players: TeamGeneratorPlayer[]) {
  return roundToOneDecimal(
    players.reduce((total, player) => total + player.rating, 0)
  );
}

function getPositionImbalance(
  teamA: TeamGeneratorPlayer[],
  teamB: TeamGeneratorPlayer[]
) {
  const styles = new Set([
    ...teamA.map((player) => player.preferredStyle ?? "all_rounder"),
    ...teamB.map((player) => player.preferredStyle ?? "all_rounder"),
  ]);

  return [...styles].reduce((imbalance, style) => {
    return (
      imbalance + Math.abs(countStyle(teamA, style) - countStyle(teamB, style))
    );
  }, 0);
}

function countStyle(players: TeamGeneratorPlayer[], style: string) {
  return players.filter(
    (player) => (player.preferredStyle ?? "all_rounder") === style
  ).length;
}

function getGoalkeeperImbalance(
  teamA: TeamGeneratorPlayer[],
  teamB: TeamGeneratorPlayer[],
  goalkeeperMode: TeamGeneratorGoalkeeperMode
) {
  if (goalkeeperMode === "no_goalkeeper") {
    return 0;
  }

  return Math.abs(
    countStyle(teamA, "goalkeeper") - countStyle(teamB, "goalkeeper")
  );
}

function toGeneratedTeam(
  label: GeneratedTeam["label"],
  players: GeneratedTeamPlayer[]
): GeneratedTeam {
  return {
    label,
    totalRating: getTotalRating(players),
    averageRating: roundToOneDecimal(getAverageRating(players)),
    players: players.map((player, index) => ({
      playerId: player.playerId,
      rating: player.rating,
      preferredStyle: player.preferredStyle,
      slot: index + 1,
    })),
  };
}

function buildExplanation(
  teamA: GeneratedTeam,
  teamB: GeneratedTeam,
  scoreComponents: TeamGenerationScoreComponents
): TeamGenerationExplanation {
  return {
    summary: `Team A averages ${teamA.averageRating}/100 and Team B averages ${teamB.averageRating}/100, with a ${scoreComponents.ratingGap}/100 rating gap.`,
    bullets: [
      "The split minimizes average rating difference first.",
      "Preferred styles and goalkeeper distribution are used as balance penalties.",
      "A small seeded randomness factor keeps rerolls fresh while preserving fairness.",
    ],
  };
}

function clampRating(rating: number) {
  return Math.max(0, Math.min(100, roundToOneDecimal(rating)));
}

function hashToUnitInterval(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function roundToThreeDecimals(value: number) {
  return Math.round(value * 1000) / 1000;
}

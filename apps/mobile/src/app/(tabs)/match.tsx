import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import {
  groupGeneratorStyles,
  groupGoalkeeperModes,
  teamGenerationVersionLimit,
  type FootballGroup,
  type FootballMatch,
  type FootballMatchAttendance,
  type FootballMatchAttendanceResponse,
  type FootballMatchAttendanceStatus,
  type GroupGeneratorStyle,
  type GroupGoalkeeperMode,
  type InitialPeerRatingReadiness,
  type ManualTeamAdjustmentInput,
  type PlayerProfile,
  type SubmitFinalScoreInput,
  type SubmitMvpVoteInput,
  type TeamGenerationVersion,
  type UpsertMatchPlayerEventsInput,
} from "@fit-five/shared";
import { useEffect, useState } from "react";
import {
  Pressable,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  applyManualTeamAdjustment,
  confirmTeamGeneration,
  createFootballMatch,
  generateTeamVersion,
  getInitialPeerRatingReadiness,
  getNextFootballMatch,
  listTeamGenerations,
  listCurrentUserGroups,
  listGroupPlayers,
  submitFinalScore,
  submitMatchAttendance,
  submitMvpVote,
  upsertMatchPlayerEvents,
} from "@/api/client";
import { NextMatchCard } from "@/features/matches/next-match-card";
import { usePreferences } from "@/features/preferences/preferences-context";

type GateLoadState = "loading" | "ready" | "noGroup" | "error";
type CreateMatchState = "idle" | "creating" | "created" | "error";
type GenerationState = "idle" | "generating" | "generated" | "error";
type ManualAdjustmentState = "idle" | "applying" | "error";
type TeamLockState = "idle" | "locking" | "locked" | "error";
type ScoreSubmitState = "idle" | "submitting" | "saved" | "error";
type MatchEventsSubmitState = "idle" | "submitting" | "saved" | "error";
type MvpVoteSubmitState = "idle" | "submitting" | "saved" | "error";
type ScoreDraft = {
  teamAScore: string;
  teamBScore: string;
};
type MatchEventsDraft = Record<
  string,
  {
    goals: string;
    assists: string;
  }
>;
type MatchDraft = {
  title: string;
  date: string;
  time: string;
  location: string;
  deadlineDate: string;
  deadlineTime: string;
  playersPerTeam: number;
  generatorStyleOverride: GroupGeneratorStyle | null;
  goalkeeperModeOverride: GroupGoalkeeperMode | null;
};

export default function MatchScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { strings } = usePreferences();
  const [loadState, setLoadState] = useState<GateLoadState>("loading");
  const [activeGroup, setActiveGroup] = useState<FootballGroup | null>(null);
  const [readiness, setReadiness] = useState<InitialPeerRatingReadiness | null>(
    null
  );
  const [nextMatch, setNextMatch] = useState<FootballMatch | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [matchDraft, setMatchDraft] = useState<MatchDraft>(
    createDefaultMatchDraft
  );
  const [createState, setCreateState] = useState<CreateMatchState>("idle");
  const [attendanceState, setAttendanceState] = useState<
    "idle" | "submitting" | "error"
  >("idle");
  const [generationState, setGenerationState] =
    useState<GenerationState>("idle");
  const [manualAdjustmentState, setManualAdjustmentState] =
    useState<ManualAdjustmentState>("idle");
  const [teamLockState, setTeamLockState] = useState<TeamLockState>("idle");
  const [scoreSubmitState, setScoreSubmitState] =
    useState<ScoreSubmitState>("idle");
  const [matchEventsSubmitState, setMatchEventsSubmitState] =
    useState<MatchEventsSubmitState>("idle");
  const [mvpVoteSubmitState, setMvpVoteSubmitState] =
    useState<MvpVoteSubmitState>("idle");
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({
    teamAScore: "",
    teamBScore: "",
  });
  const [teamGenerations, setTeamGenerations] = useState<
    TeamGenerationVersion[]
  >([]);
  const [teamGeneration, setTeamGeneration] =
    useState<TeamGenerationVersion | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function loadGate() {
    setLoadState("loading");
    setActionMessage(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const groupsResponse = await listCurrentUserGroups(token);
      const firstGroup = groupsResponse.data.groups[0];

      if (!firstGroup) {
        setActiveGroup(null);
        setReadiness(null);
        setNextMatch(null);
        setPlayers([]);
        setTeamGenerations([]);
        setTeamGeneration(null);
        setGenerationState("idle");
        setManualAdjustmentState("idle");
        setTeamLockState("idle");
        setScoreSubmitState("idle");
        setMatchEventsSubmitState("idle");
        setMvpVoteSubmitState("idle");
        setScoreDraft(createScoreDraft(null));
        setLoadState("noGroup");
        return;
      }

      const [readinessResponse, rosterResponse, nextMatchResponse] =
        await Promise.all([
          getInitialPeerRatingReadiness(token, firstGroup.id),
          listGroupPlayers(token, firstGroup.id),
          getNextFootballMatch(token, firstGroup.id),
        ]);
      const savedGenerations = nextMatchResponse.data.match
        ? (
            await listTeamGenerations(
              token,
              firstGroup.id,
              nextMatchResponse.data.match.id
            )
          ).data.generations
        : [];

      setActiveGroup(firstGroup);
      setReadiness(readinessResponse.data.readiness);
      setNextMatch(nextMatchResponse.data.match);
      setScoreDraft(createScoreDraft(nextMatchResponse.data.match));
      setScoreSubmitState("idle");
      setMatchEventsSubmitState("idle");
      setMvpVoteSubmitState("idle");
      setPlayers(rosterResponse.data.players);
      setTeamGenerations(savedGenerations);
      setTeamGeneration(selectPrimaryTeamGeneration(savedGenerations));
      setGenerationState(savedGenerations.length > 0 ? "generated" : "idle");
      setTeamLockState(
        savedGenerations.some((generation) => generation.status === "locked")
          ? "locked"
          : "idle"
      );
      setLoadState("ready");
    } catch (error) {
      console.warn("Unable to load generation gate", error);
      setLoadState("error");
    }
  }

  useEffect(() => {
    void loadGate();
  }, [getToken]);

  async function handleRemindGroup() {
    try {
      await Share.share({
        message: strings.generation.remindMessage,
      });
    } catch (error) {
      console.warn("Unable to share generation reminder", error);
    }
  }

  async function handleGenerateTeamVersion() {
    if (!activeGroup || !nextMatch) {
      setActionMessage(strings.generation.noMatchForGeneration);
      return;
    }

    if (teamGenerations.length >= teamGenerationVersionLimit) {
      setActionMessage(strings.generation.versionLimitExplanation);
      return;
    }

    if (
      nextMatch.status === "locked" ||
      teamGenerations.some((generation) => generation.status === "locked")
    ) {
      setActionMessage(strings.generation.teamsAlreadyLocked);
      return;
    }

    setGenerationState("generating");
    setActionMessage(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await generateTeamVersion(
        token,
        activeGroup.id,
        nextMatch.id
      );
      const generationsResponse = await listTeamGenerations(
        token,
        activeGroup.id,
        nextMatch.id
      );
      const savedGenerations = generationsResponse.data.generations;

      setTeamGenerations(savedGenerations);
      setTeamGeneration(
        savedGenerations.find(
          (generation) => generation.id === response.data.generation.id
        ) ?? response.data.generation
      );
      setGenerationState("generated");
      setTeamLockState("idle");
    } catch (error) {
      console.warn("Unable to generate teams", error);
      setGenerationState("error");
      setActionMessage(
        teamGenerations.length >= teamGenerationVersionLimit
          ? strings.generation.versionLimitExplanation
          : strings.generation.generateError
      );
    }
  }

  async function handleApplyManualAdjustment(
    generationId: string,
    input: ManualTeamAdjustmentInput
  ) {
    if (!activeGroup || !nextMatch) {
      setActionMessage(strings.generation.noMatchForGeneration);
      return;
    }

    setManualAdjustmentState("applying");
    setActionMessage(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await applyManualTeamAdjustment(
        token,
        activeGroup.id,
        nextMatch.id,
        generationId,
        input
      );
      const updatedGeneration = response.data.generation;

      setTeamGenerations((currentGenerations) =>
        currentGenerations.map((generation) =>
          generation.id === updatedGeneration.id ? updatedGeneration : generation
        )
      );
      setTeamGeneration(updatedGeneration);
      setManualAdjustmentState("idle");
      setActionMessage(strings.generation.manualAdjustmentSaved);
    } catch (error) {
      console.warn("Unable to apply manual adjustment", error);
      setManualAdjustmentState("error");
      setActionMessage(strings.generation.manualAdjustmentError);
    }
  }

  async function handleConfirmTeamGeneration(generationId: string) {
    if (!activeGroup || !nextMatch) {
      setActionMessage(strings.generation.noMatchForGeneration);
      return;
    }

    setTeamLockState("locking");
    setActionMessage(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await confirmTeamGeneration(
        token,
        activeGroup.id,
        nextMatch.id,
        generationId
      );
      const updatedGeneration = response.data.generation;

      setNextMatch(response.data.match);
      setScoreDraft(createScoreDraft(response.data.match));
      setScoreSubmitState("idle");
      setMatchEventsSubmitState("idle");
      setMvpVoteSubmitState("idle");
      setTeamGenerations((currentGenerations) =>
        currentGenerations.map((generation) =>
          generation.id === updatedGeneration.id ? updatedGeneration : generation
        )
      );
      setTeamGeneration(updatedGeneration);
      setManualAdjustmentState("idle");
      setTeamLockState("locked");
      setActionMessage(strings.generation.teamsLockedSaved);
    } catch (error) {
      console.warn("Unable to confirm team generation", error);
      setTeamLockState("error");
      setActionMessage(strings.generation.teamsLockedError);
    }
  }

  async function handleSubmitFinalScore(input: SubmitFinalScoreInput) {
    if (!activeGroup || !nextMatch) {
      setActionMessage(strings.generation.noMatchForGeneration);
      return;
    }

    setScoreSubmitState("submitting");
    setActionMessage(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await submitFinalScore(
        token,
        activeGroup.id,
        nextMatch.id,
        input
      );

      setNextMatch(response.data.match);
      setScoreDraft(createScoreDraft(response.data.match));
      setMatchEventsSubmitState("idle");
      setMvpVoteSubmitState("idle");
      setScoreSubmitState("saved");
      setActionMessage(strings.matches.finalScoreSaved);
    } catch (error) {
      console.warn("Unable to submit final score", error);
      setScoreSubmitState("error");
      setActionMessage(strings.matches.finalScoreError);
    }
  }

  async function handleSubmitMatchEvents(input: UpsertMatchPlayerEventsInput) {
    if (!activeGroup || !nextMatch) {
      setActionMessage(strings.generation.noMatchForGeneration);
      return;
    }

    setMatchEventsSubmitState("submitting");
    setActionMessage(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await upsertMatchPlayerEvents(
        token,
        activeGroup.id,
        nextMatch.id,
        input
      );

      setNextMatch(response.data.match);
      setMatchEventsSubmitState("saved");
      setActionMessage(strings.matches.matchEventsSaved);
    } catch (error) {
      console.warn("Unable to submit match events", error);
      setMatchEventsSubmitState("error");
      setActionMessage(strings.matches.matchEventsError);
    }
  }

  async function handleSubmitMvpVote(input: SubmitMvpVoteInput) {
    if (!activeGroup || !nextMatch) {
      setActionMessage(strings.generation.noMatchForGeneration);
      return;
    }

    setMvpVoteSubmitState("submitting");
    setActionMessage(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await submitMvpVote(
        token,
        activeGroup.id,
        nextMatch.id,
        input
      );

      setNextMatch(response.data.match);
      setMvpVoteSubmitState("saved");
      setActionMessage(strings.matches.mvpVoteSaved);
    } catch (error) {
      console.warn("Unable to submit MVP vote", error);
      setMvpVoteSubmitState("error");
      setActionMessage(strings.matches.mvpVoteError);
    }
  }

  async function handleCreateMatch() {
    if (!activeGroup) {
      return;
    }

    const startsAt = parseLocalDateTime(matchDraft.date, matchDraft.time);
    const attendanceDeadlineAt = parseLocalDateTime(
      matchDraft.deadlineDate,
      matchDraft.deadlineTime
    );

    if (!startsAt || !attendanceDeadlineAt) {
      setCreateState("error");
      return;
    }

    setCreateState("creating");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await createFootballMatch(token, activeGroup.id, {
        title: matchDraft.title,
        startsAt: startsAt.toISOString(),
        location: matchDraft.location,
        playersPerTeam: matchDraft.playersPerTeam,
        attendanceDeadlineAt: attendanceDeadlineAt.toISOString(),
        generatorStyleOverride: matchDraft.generatorStyleOverride,
        goalkeeperModeOverride: matchDraft.goalkeeperModeOverride,
      });

      setNextMatch(response.data.match);
      setTeamGenerations([]);
      setTeamGeneration(null);
      setManualAdjustmentState("idle");
      setTeamLockState("idle");
      setScoreSubmitState("idle");
      setMatchEventsSubmitState("idle");
      setMvpVoteSubmitState("idle");
      setScoreDraft(createScoreDraft(response.data.match));
      setCreateState("created");
    } catch (error) {
      console.warn("Unable to create match", error);
      setCreateState("error");
    }
  }

  async function handleSubmitAttendance(
    response: FootballMatchAttendanceResponse
  ) {
    if (!activeGroup || !nextMatch) {
      return;
    }

    setAttendanceState("submitting");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const attendanceResponse = await submitMatchAttendance(
        token,
        activeGroup.id,
        nextMatch.id,
        {
          response,
        }
      );

      setNextMatch(attendanceResponse.data.match);
      setTeamGenerations([]);
      setTeamGeneration(null);
      setGenerationState("idle");
      setManualAdjustmentState("idle");
      setTeamLockState("idle");
      setScoreSubmitState("idle");
      setMatchEventsSubmitState("idle");
      setMvpVoteSubmitState("idle");
      setScoreDraft(createScoreDraft(attendanceResponse.data.match));
      setAttendanceState("idle");
    } catch (error) {
      console.warn("Unable to submit attendance", error);
      setAttendanceState("error");
    }
  }

  const canCreateMatch =
    activeGroup?.currentUserRole === "owner" ||
    activeGroup?.currentUserRole === "admin";
  const missingPlayers = getMissingPlayers(readiness, players);
  const generationLimitReached =
    teamGenerations.length >= teamGenerationVersionLimit;
  const teamsLocked =
    nextMatch?.status === "locked" ||
    teamGenerations.some((generation) => generation.status === "locked");
  const generationPoolReady =
    Boolean(readiness?.ready) &&
    (nextMatch ? nextMatch.confirmedCount === nextMatch.maxPlayers : false) &&
    nextMatch?.status === "open" &&
    !generationLimitReached &&
    !teamsLocked;
  const generationBlockedReason = getGenerationBlockedReason(
    readiness,
    nextMatch,
    generationLimitReached,
    teamsLocked,
    strings
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>{strings.navigation.match}</Text>
          <Text style={styles.title}>{strings.generation.gateTitle}</Text>
          <Text style={styles.subtitle}>{strings.generation.gateSubtitle}</Text>
        </View>

        {activeGroup ? (
          <View style={styles.groupCard}>
            <View>
              <Text style={styles.groupLabel}>
                {strings.players.rosterGroupLabel}
              </Text>
              <Text style={styles.groupName}>{activeGroup.name}</Text>
            </View>
            <Pressable
              onPress={() => void loadGate()}
              style={styles.reloadButton}
            >
              <Text style={styles.reloadButtonText}>
                {strings.generation.reload}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {loadState === "loading" ? (
          <Text style={styles.statusText}>{strings.auth.loadingSession}</Text>
        ) : null}

        {loadState === "noGroup" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {strings.generation.noGroupTitle}
            </Text>
            <Text style={styles.subtitle}>
              {strings.generation.noGroupSubtitle}
            </Text>
          </View>
        ) : null}

        {loadState === "error" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{strings.generation.gateTitle}</Text>
            <Text style={styles.errorText}>{strings.generation.loadError}</Text>
          </View>
        ) : null}

        {loadState === "ready" && nextMatch ? (
          <>
            <NextMatchCard
              match={nextMatch}
              responseState={attendanceState}
              onRespond={handleSubmitAttendance}
            />
            <AttendanceListsCard match={nextMatch} players={players} />
          </>
        ) : null}

        {loadState === "ready" && activeGroup && canCreateMatch ? (
          <CreateMatchCard
            createState={createState}
            draft={matchDraft}
            group={activeGroup}
            onChange={setMatchDraft}
            onSubmit={handleCreateMatch}
          />
        ) : null}

        {loadState === "ready" && !nextMatch ? (
          <Text style={styles.statusText}>{strings.matches.noNextMatch}</Text>
        ) : null}

        {loadState === "ready" && readiness ? (
          <>
            <GenerationGateCard
              canGenerate={generationPoolReady}
              disabledReason={generationBlockedReason}
              generationCount={teamGenerations.length}
              generationLimit={teamGenerationVersionLimit}
              generationState={generationState}
              hasGeneratedVersion={teamGenerations.length > 0}
              readiness={readiness}
              onGenerate={handleGenerateTeamVersion}
            />

            {actionMessage ? (
              <Text style={styles.successText}>{actionMessage}</Text>
            ) : null}

            {teamGeneration ? (
              <GeneratedTeamsCard
                generation={teamGeneration}
                generations={teamGenerations}
                manualAdjustmentState={manualAdjustmentState}
                teamLockState={teamLockState}
                onApplyManualAdjustment={handleApplyManualAdjustment}
                onConfirmGeneration={handleConfirmTeamGeneration}
                onSelectGeneration={setTeamGeneration}
                players={players}
              />
            ) : null}

            {nextMatch?.status === "locked" ? (
              <FinalScoreCard
                canEditScore={canCreateMatch}
                draft={scoreDraft}
                match={nextMatch}
                onChange={setScoreDraft}
                onSubmit={handleSubmitFinalScore}
                submitState={scoreSubmitState}
              />
            ) : null}

            {nextMatch?.status === "locked" &&
            nextMatch.score &&
            teamGeneration?.status === "locked" ? (
              <MatchEventsCard
                canEditEvents={canCreateMatch}
                match={nextMatch}
                onSubmit={handleSubmitMatchEvents}
                players={players}
                submitState={matchEventsSubmitState}
                teamPlayers={getLockedTeamPlayers(teamGeneration)}
              />
            ) : null}

            {nextMatch?.status === "locked" &&
            teamGeneration?.status === "locked" ? (
              <MvpVoteCard
                match={nextMatch}
                onSubmit={handleSubmitMvpVote}
                players={players}
                submitState={mvpVoteSubmitState}
                teamPlayers={getLockedTeamPlayers(teamGeneration)}
              />
            ) : null}

            {!readiness.ready ? (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => router.push("/joueurs")}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>
                    {strings.generation.ratePlayers}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleRemindGroup}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>
                    {strings.generation.remindGroup}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {strings.generation.missingTitle}
              </Text>
              <Text style={styles.helperText}>
                {readiness.ready
                  ? strings.ratings.progressReadyTitle
                  : strings.generation.blockedExplanation}
              </Text>

              <View style={styles.missingList}>
                {missingPlayers.map(({ player, progress }) => (
                  <View key={progress.playerId} style={styles.missingRow}>
                    <View>
                      <Text style={styles.missingName}>
                        {getPlayerDisplayName(
                          player,
                          strings.profile.fallbackName
                        )}
                      </Text>
                      <Text style={styles.missingMeta}>
                        {progress.ratingsReceived}/{readiness.threshold}{" "}
                        {strings.ratings.ratingsReceivedLabel}
                      </Text>
                    </View>
                    <Text style={styles.missingBadge}>
                      {progress.ratingsNeeded}{" "}
                      {strings.generation.missingRatingsLabel}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function GenerationGateCard({
  canGenerate,
  disabledReason,
  generationCount,
  generationLimit,
  generationState,
  hasGeneratedVersion,
  readiness,
  onGenerate,
}: {
  canGenerate: boolean;
  disabledReason: string | null;
  generationCount: number;
  generationLimit: number;
  generationState: GenerationState;
  hasGeneratedVersion: boolean;
  readiness: InitialPeerRatingReadiness;
  onGenerate: () => void;
}) {
  const { strings } = usePreferences();
  const isGenerating = generationState === "generating";
  const disabled = !canGenerate || isGenerating;

  return (
    <View style={[styles.gateCard, readiness.ready && styles.gateCardReady]}>
      <View style={styles.gateTopRow}>
        <View style={styles.gateCopy}>
          <Text style={styles.gateKicker}>{strings.generation.gateTitle}</Text>
          <Text style={styles.gateTitle}>
            {readiness.ready
              ? strings.generation.gateReadyTitle
              : strings.generation.gateBlockedTitle}
          </Text>
        </View>
        <Text style={styles.gatePercent}>{readiness.progressPercent}%</Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${readiness.progressPercent}%` as `${number}%`,
            },
          ]}
        />
      </View>

      <View style={styles.statRow}>
        <Text style={styles.statPill}>
          {readiness.readyPlayers}/{readiness.totalPlayers}{" "}
          {strings.ratings.progressPlayersReady}
        </Text>
        <Text style={styles.statPill}>
          {readiness.incompletePlayers} {strings.generation.missingRatingsLabel}
        </Text>
        <Text style={styles.statPill}>
          {generationCount}/{generationLimit}{" "}
          {strings.generation.versionCountLabel}
        </Text>
      </View>

      <Text style={styles.helperText}>
        {strings.generation.temporaryPoolNote}
      </Text>

      <Pressable
        disabled={disabled}
        onPress={onGenerate}
        style={[
          styles.generateButton,
          disabled && styles.generateButtonDisabled,
        ]}
      >
        <Text
          style={[
            styles.generateButtonText,
            disabled && styles.generateButtonTextDisabled,
          ]}
        >
          {isGenerating
            ? strings.generation.generatingTeams
            : canGenerate
              ? hasGeneratedVersion
                ? strings.generation.regenerateTeams
                : strings.generation.generateTeams
              : strings.generation.generateLocked}
        </Text>
      </Pressable>

      {disabledReason ? (
        <Text style={styles.lockedExplanation}>{disabledReason}</Text>
      ) : null}
    </View>
  );
}

function CreateMatchCard({
  createState,
  draft,
  group,
  onChange,
  onSubmit,
}: {
  createState: CreateMatchState;
  draft: MatchDraft;
  group: FootballGroup;
  onChange: (draft: MatchDraft) => void;
  onSubmit: () => void;
}) {
  const { strings } = usePreferences();
  const canSubmit =
    createState !== "creating" &&
    draft.title.trim().length >= 2 &&
    draft.location.trim().length >= 2;

  function updateDraft(partialDraft: Partial<MatchDraft>) {
    onChange({
      ...draft,
      ...partialDraft,
    });
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{strings.matches.createTitle}</Text>
      <Text style={styles.helperText}>{strings.matches.createSubtitle}</Text>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{strings.matches.titleLabel}</Text>
        <TextInput
          onChangeText={(title) => updateDraft({ title })}
          placeholder={strings.matches.titlePlaceholder}
          placeholderTextColor="#6B7482"
          style={styles.input}
          value={draft.title}
        />
      </View>

      <View style={styles.formRow}>
        <View style={styles.formColumn}>
          <Text style={styles.fieldLabel}>{strings.matches.dateLabel}</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={(date) => updateDraft({ date })}
            placeholder="2026-06-10"
            placeholderTextColor="#6B7482"
            style={styles.input}
            value={draft.date}
          />
        </View>
        <View style={styles.formColumn}>
          <Text style={styles.fieldLabel}>{strings.matches.timeLabel}</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={(time) => updateDraft({ time })}
            placeholder="20:00"
            placeholderTextColor="#6B7482"
            style={styles.input}
            value={draft.time}
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{strings.matches.locationLabel}</Text>
        <TextInput
          onChangeText={(location) => updateDraft({ location })}
          placeholder={strings.matches.locationPlaceholder}
          placeholderTextColor="#6B7482"
          style={styles.input}
          value={draft.location}
        />
      </View>

      <View style={styles.formRow}>
        <View style={styles.formColumn}>
          <Text style={styles.fieldLabel}>
            {strings.matches.attendanceDeadlineLabel}
          </Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={(deadlineDate) => updateDraft({ deadlineDate })}
            placeholder="2026-06-10"
            placeholderTextColor="#6B7482"
            style={styles.input}
            value={draft.deadlineDate}
          />
        </View>
        <View style={styles.formColumn}>
          <Text style={styles.fieldLabel}>{strings.matches.timeLabel}</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={(deadlineTime) => updateDraft({ deadlineTime })}
            placeholder="18:00"
            placeholderTextColor="#6B7482"
            style={styles.input}
            value={draft.deadlineTime}
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>
          {strings.matches.playersPerTeamLabel}
        </Text>
        <View style={styles.optionRow}>
          {[5, 6, 7].map((playersPerTeam) => (
            <OptionPill
              key={playersPerTeam}
              active={draft.playersPerTeam === playersPerTeam}
              label={`${playersPerTeam}v${playersPerTeam}`}
              onPress={() => updateDraft({ playersPerTeam })}
            />
          ))}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>
          {strings.matches.generatorOverrideLabel}
        </Text>
        <View style={styles.optionRow}>
          <OptionPill
            active={draft.generatorStyleOverride === null}
            label={`${strings.matches.groupDefault}: ${
              strings.groups.options.generatorStyle[
                group.settings.generatorStyle
              ]
            }`}
            onPress={() => updateDraft({ generatorStyleOverride: null })}
          />
          {groupGeneratorStyles.map((style) => (
            <OptionPill
              key={style}
              active={draft.generatorStyleOverride === style}
              label={strings.groups.options.generatorStyle[style]}
              onPress={() => updateDraft({ generatorStyleOverride: style })}
            />
          ))}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>
          {strings.matches.goalkeeperOverrideLabel}
        </Text>
        <View style={styles.optionRow}>
          <OptionPill
            active={draft.goalkeeperModeOverride === null}
            label={`${strings.matches.groupDefault}: ${
              strings.groups.options.goalkeeperMode[
                group.settings.goalkeeperMode
              ]
            }`}
            onPress={() => updateDraft({ goalkeeperModeOverride: null })}
          />
          {groupGoalkeeperModes.map((mode) => (
            <OptionPill
              key={mode}
              active={draft.goalkeeperModeOverride === mode}
              label={strings.groups.options.goalkeeperMode[mode]}
              onPress={() => updateDraft({ goalkeeperModeOverride: mode })}
            />
          ))}
        </View>
      </View>

      <Pressable
        disabled={!canSubmit}
        onPress={() => void onSubmit()}
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
      >
        <Text style={styles.submitButtonText}>
          {createState === "creating"
            ? strings.matches.creating
            : strings.matches.createButton}
        </Text>
      </Pressable>

      {createState === "created" ? (
        <Text style={styles.successText}>{strings.matches.created}</Text>
      ) : null}
      {createState === "error" ? (
        <Text style={styles.errorText}>{strings.matches.createError}</Text>
      ) : null}
    </View>
  );
}

function AttendanceListsCard({
  match,
  players,
}: {
  match: FootballMatch;
  players: PlayerProfile[];
}) {
  const { strings } = usePreferences();
  const playersById = new Map(players.map((player) => [player.id, player]));
  const sections = (["confirmed", "waitlisted", "maybe", "out"] as const).map(
    (status) => {
      const attendances = getSortedAttendances(match.attendances, status);

      return {
        status,
        attendances,
        title: getAttendanceSectionTitle(status, attendances.length, match),
      };
    }
  );

  return (
    <View style={styles.attendanceCard}>
      <View style={styles.attendanceHeader}>
        <View style={styles.attendanceHeaderCopy}>
          <Text style={styles.cardTitle}>
            {strings.matches.attendanceListTitle}
          </Text>
          <Text style={styles.helperText}>
            {strings.matches.attendanceListSubtitle}
          </Text>
        </View>
        <Text style={styles.attendanceTotalBadge}>
          {match.attendances.length} {strings.matches.attendanceListResponses}
        </Text>
      </View>

      {sections.map((section) => (
        <View key={section.status} style={styles.attendanceSection}>
          <View style={styles.attendanceSectionHeader}>
            <Text style={styles.attendanceSectionTitle}>
              {getAttendanceSectionLabel(section.status, strings)}
            </Text>
            <Text style={styles.attendanceSectionCount}>{section.title}</Text>
          </View>

          {section.attendances.length > 0 ? (
            <View style={styles.attendanceRows}>
              {section.attendances.map((attendance) => (
                <AttendancePlayerRow
                  key={attendance.id}
                  attendance={attendance}
                  player={playersById.get(attendance.playerId) ?? null}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.attendanceEmptyText}>
              {strings.matches.attendanceListEmpty}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function AttendancePlayerRow({
  attendance,
  player,
}: {
  attendance: FootballMatchAttendance;
  player: PlayerProfile | null;
}) {
  const { strings } = usePreferences();
  const displayName = getPlayerDisplayName(
    player,
    strings.profile.fallbackName
  );
  const fullName = player
    ? [player.firstName, player.lastName].filter(Boolean).join(" ")
    : "";
  const subtitle =
    player?.nickname && fullName.length > 0
      ? fullName
      : (player?.clubDeFormation ?? strings.matches.attendanceUnknownPlayer);

  return (
    <View style={styles.attendanceRow}>
      <View style={styles.attendanceAvatarWrap}>
        {player?.photoUrl ? (
          <Image
            source={{ uri: player.photoUrl }}
            style={styles.attendanceAvatar}
          />
        ) : (
          <Text style={styles.attendanceAvatarFallback}>
            {displayName.slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>

      <View style={styles.attendancePlayerBody}>
        <Text style={styles.attendancePlayerName}>{displayName}</Text>
        <Text style={styles.attendancePlayerMeta}>{subtitle}</Text>
      </View>

      <Text
        style={[
          styles.attendanceStatusBadge,
          getAttendanceStatusStyle(attendance.status),
        ]}
      >
        {getAttendanceStatusText(attendance, strings)}
      </Text>
    </View>
  );
}

function FinalScoreCard({
  canEditScore,
  draft,
  match,
  onChange,
  onSubmit,
  submitState,
}: {
  canEditScore: boolean;
  draft: ScoreDraft;
  match: FootballMatch;
  onChange: (draft: ScoreDraft) => void;
  onSubmit: (input: SubmitFinalScoreInput) => void;
  submitState: ScoreSubmitState;
}) {
  const { strings } = usePreferences();
  const scoreInput = parseScoreDraft(draft);
  const isSubmitting = submitState === "submitting";
  const canSubmit = canEditScore && !isSubmitting && scoreInput !== null;

  function updateDraft(partialDraft: Partial<ScoreDraft>) {
    onChange({
      ...draft,
      ...partialDraft,
    });
  }

  return (
    <View style={styles.finalScoreCard}>
      <View style={styles.attendanceHeader}>
        <View style={styles.attendanceHeaderCopy}>
          <Text style={styles.cardTitle}>{strings.matches.finalScoreTitle}</Text>
          <Text style={styles.helperText}>
            {strings.matches.finalScoreSubtitle}
          </Text>
        </View>
        {match.score ? (
          <Text style={styles.lockBadge}>
            {strings.matches.finalScoreSubmitted}
          </Text>
        ) : null}
      </View>

      <View style={styles.scoreBoard}>
        <View style={styles.scoreTeam}>
          <Text style={styles.scoreTeamLabel}>
            {strings.generation.teamLabel} A
          </Text>
          <Text style={styles.scoreNumber}>
            {match.score?.teamAScore ?? "-"}
          </Text>
        </View>
        <Text style={styles.scoreSeparator}>-</Text>
        <View style={styles.scoreTeam}>
          <Text style={styles.scoreTeamLabel}>
            {strings.generation.teamLabel} B
          </Text>
          <Text style={styles.scoreNumber}>
            {match.score?.teamBScore ?? "-"}
          </Text>
        </View>
      </View>

      {canEditScore ? (
        <>
          <View style={styles.scoreInputRow}>
            <View style={styles.scoreInputColumn}>
              <Text style={styles.fieldLabel}>
                {strings.matches.teamAScoreLabel}
              </Text>
              <TextInput
                keyboardType="number-pad"
                maxLength={2}
                onChangeText={(teamAScore) => updateDraft({ teamAScore })}
                placeholder="0"
                placeholderTextColor="#6B7482"
                style={styles.input}
                value={draft.teamAScore}
              />
            </View>
            <View style={styles.scoreInputColumn}>
              <Text style={styles.fieldLabel}>
                {strings.matches.teamBScoreLabel}
              </Text>
              <TextInput
                keyboardType="number-pad"
                maxLength={2}
                onChangeText={(teamBScore) => updateDraft({ teamBScore })}
                placeholder="0"
                placeholderTextColor="#6B7482"
                style={styles.input}
                value={draft.teamBScore}
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={() => {
              if (scoreInput) {
                onSubmit(scoreInput);
              }
            }}
            style={[
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
            ]}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting
                ? strings.matches.savingFinalScore
                : match.score
                  ? strings.matches.updateFinalScore
                  : strings.matches.saveFinalScore}
            </Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.helperText}>
          {match.score
            ? strings.matches.finalScoreViewerHint
            : strings.matches.noFinalScore}
        </Text>
      )}

      {submitState === "error" ? (
        <Text style={styles.errorText}>{strings.matches.finalScoreError}</Text>
      ) : null}
    </View>
  );
}

function MatchEventsCard({
  canEditEvents,
  match,
  onSubmit,
  players,
  submitState,
  teamPlayers,
}: {
  canEditEvents: boolean;
  match: FootballMatch;
  onSubmit: (input: UpsertMatchPlayerEventsInput) => void;
  players: PlayerProfile[];
  submitState: MatchEventsSubmitState;
  teamPlayers: Array<{
    playerId: string;
    teamLabel: "A" | "B";
  }>;
}) {
  const { strings } = usePreferences();
  const playersById = new Map(players.map((player) => [player.id, player]));
  const [draft, setDraft] = useState<MatchEventsDraft>(() =>
    createMatchEventsDraft(match, teamPlayers)
  );
  const parsedInput = parseMatchEventsDraft(draft, teamPlayers);
  const isSubmitting = submitState === "submitting";
  const canSubmit = canEditEvents && !isSubmitting && parsedInput !== null;
  const scoringEvents = match.events.filter((event) => event.count > 0);
  const teamPlayerKey = teamPlayers
    .map((teamPlayer) => `${teamPlayer.teamLabel}:${teamPlayer.playerId}`)
    .join("|");

  useEffect(() => {
    setDraft(createMatchEventsDraft(match, teamPlayers));
  }, [match.events, match.id, teamPlayerKey]);

  function updateDraft(
    playerId: string,
    field: keyof MatchEventsDraft[string],
    value: string
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [playerId]: {
        goals: currentDraft[playerId]?.goals ?? "",
        assists: currentDraft[playerId]?.assists ?? "",
        [field]: value,
      },
    }));
  }

  return (
    <View style={styles.matchEventsCard}>
      <View style={styles.attendanceHeader}>
        <View style={styles.attendanceHeaderCopy}>
          <Text style={styles.cardTitle}>{strings.matches.matchEventsTitle}</Text>
          <Text style={styles.helperText}>
            {strings.matches.matchEventsSubtitle}
          </Text>
        </View>
        {scoringEvents.length > 0 ? (
          <Text style={styles.lockBadge}>
            {strings.matches.matchEventsSavedBadge}
          </Text>
        ) : null}
      </View>

      {scoringEvents.length > 0 ? (
        <View style={styles.eventSummaryList}>
          {scoringEvents.map((event) => {
            const player = playersById.get(event.playerId) ?? null;
            const displayName = getPlayerDisplayName(
              player,
              strings.profile.fallbackName
            );

            return (
              <Text key={event.id} style={styles.eventSummaryText}>
                {displayName}: {event.count}{" "}
                {event.kind === "goal"
                  ? strings.matches.goalsShortLabel
                  : strings.matches.assistsShortLabel}
              </Text>
            );
          })}
        </View>
      ) : (
        <Text style={styles.helperText}>{strings.matches.noMatchEvents}</Text>
      )}

      {canEditEvents ? (
        <>
          <View style={styles.eventRows}>
            <View style={styles.eventInputHeaderRow}>
              <Text style={styles.eventInputHeaderSpacer} />
              <Text style={styles.eventInputHeader}>
                {strings.matches.goalsShortLabel}
              </Text>
              <Text style={styles.eventInputHeader}>
                {strings.matches.assistsShortLabel}
              </Text>
            </View>
            {teamPlayers.map((teamPlayer) => {
              const player = playersById.get(teamPlayer.playerId) ?? null;
              const displayName = getPlayerDisplayName(
                player,
                strings.profile.fallbackName
              );
              const rowDraft = draft[teamPlayer.playerId] ?? {
                goals: "",
                assists: "",
              };

              return (
                <View key={teamPlayer.playerId} style={styles.eventRow}>
                  <View style={styles.eventPlayerCopy}>
                    <Text style={styles.eventPlayerName}>{displayName}</Text>
                    <Text style={styles.eventPlayerMeta}>
                      {strings.generation.teamLabel} {teamPlayer.teamLabel}
                    </Text>
                  </View>
                  <TextInput
                    accessibilityLabel={`${displayName} ${strings.matches.goalsShortLabel}`}
                    keyboardType="number-pad"
                    maxLength={2}
                    onChangeText={(goals) =>
                      updateDraft(teamPlayer.playerId, "goals", goals)
                    }
                    placeholder="0"
                    placeholderTextColor="#6B7482"
                    style={styles.eventInput}
                    value={rowDraft.goals}
                  />
                  <TextInput
                    accessibilityLabel={`${displayName} ${strings.matches.assistsShortLabel}`}
                    keyboardType="number-pad"
                    maxLength={2}
                    onChangeText={(assists) =>
                      updateDraft(teamPlayer.playerId, "assists", assists)
                    }
                    placeholder="0"
                    placeholderTextColor="#6B7482"
                    style={styles.eventInput}
                    value={rowDraft.assists}
                  />
                </View>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={() => {
              if (parsedInput) {
                onSubmit(parsedInput);
              }
            }}
            style={[
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
            ]}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting
                ? strings.matches.savingMatchEvents
                : strings.matches.saveMatchEvents}
            </Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.helperText}>
          {strings.matches.matchEventsViewerHint}
        </Text>
      )}

      {submitState === "error" ? (
        <Text style={styles.errorText}>{strings.matches.matchEventsError}</Text>
      ) : null}
    </View>
  );
}

function MvpVoteCard({
  match,
  onSubmit,
  players,
  submitState,
  teamPlayers,
}: {
  match: FootballMatch;
  onSubmit: (input: SubmitMvpVoteInput) => void;
  players: PlayerProfile[];
  submitState: MvpVoteSubmitState;
  teamPlayers: ReturnType<typeof getLockedTeamPlayers>;
}) {
  const { strings } = usePreferences();
  const playersById = new Map(players.map((player) => [player.id, player]));
  const voteCounts = getMvpVoteCounts(match);
  const voterPlayerId =
    match.myAttendance?.status === "confirmed"
      ? match.myAttendance.playerId
      : null;
  const votedPlayer = match.myMvpVote
    ? (playersById.get(match.myMvpVote.votedPlayerId) ?? null)
    : null;
  const votedPlayerName = match.myMvpVote
    ? getPlayerDisplayName(votedPlayer, strings.profile.fallbackName)
    : null;
  const isSubmitting = submitState === "submitting";
  const hasVoted = Boolean(match.myMvpVote);
  const canVote = Boolean(voterPlayerId) && !hasVoted && !isSubmitting;

  return (
    <View style={styles.mvpVoteCard}>
      <View style={styles.attendanceHeader}>
        <View style={styles.attendanceHeaderCopy}>
          <Text style={styles.cardTitle}>{strings.matches.mvpVoteTitle}</Text>
          <Text style={styles.helperText}>{strings.matches.mvpVoteSubtitle}</Text>
        </View>
        {hasVoted ? (
          <Text style={styles.lockBadge}>{strings.matches.mvpVoteSavedBadge}</Text>
        ) : null}
      </View>

      {!voterPlayerId ? (
        <Text style={styles.helperText}>{strings.matches.mvpVoteNotConfirmed}</Text>
      ) : null}

      {votedPlayerName ? (
        <Text style={styles.mvpChosenText}>
          {strings.matches.mvpVoteAlreadyVoted}: {votedPlayerName}
        </Text>
      ) : null}

      <View style={styles.mvpRows}>
        {teamPlayers.map((teamPlayer) => {
          const player = playersById.get(teamPlayer.playerId) ?? null;
          const displayName = getPlayerDisplayName(
            player,
            strings.profile.fallbackName
          );
          const isSelf = teamPlayer.playerId === voterPlayerId;
          const disabled = !canVote || isSelf;
          const voteCount = voteCounts.get(teamPlayer.playerId) ?? 0;

          return (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              key={teamPlayer.playerId}
              onPress={() => onSubmit({ votedPlayerId: teamPlayer.playerId })}
              style={[styles.mvpRow, disabled && styles.mvpRowDisabled]}
            >
              <View style={styles.mvpPlayerCopy}>
                <Text style={styles.mvpPlayerName}>{displayName}</Text>
                <Text style={styles.mvpPlayerMeta}>
                  {strings.generation.teamLabel} {teamPlayer.teamLabel}
                  {isSelf ? ` - ${strings.matches.mvpVoteSelfLabel}` : ""}
                </Text>
              </View>
              <Text style={styles.mvpCountBadge}>
                {voteCount} {strings.matches.mvpVoteCountLabel}
              </Text>
              {!disabled ? (
                <Text style={styles.mvpActionText}>
                  {isSubmitting
                    ? strings.matches.mvpVoteSubmitting
                    : strings.matches.mvpVoteButton}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {submitState === "error" ? (
        <Text style={styles.errorText}>{strings.matches.mvpVoteError}</Text>
      ) : null}
    </View>
  );
}

function GeneratedTeamsCard({
  generation,
  generations,
  manualAdjustmentState,
  teamLockState,
  onApplyManualAdjustment,
  onConfirmGeneration,
  onSelectGeneration,
  players,
}: {
  generation: TeamGenerationVersion;
  generations: TeamGenerationVersion[];
  manualAdjustmentState: ManualAdjustmentState;
  teamLockState: TeamLockState;
  onApplyManualAdjustment: (
    generationId: string,
    input: ManualTeamAdjustmentInput
  ) => void;
  onConfirmGeneration: (generationId: string) => void;
  onSelectGeneration: (generation: TeamGenerationVersion) => void;
  players: PlayerProfile[];
}) {
  const { strings } = usePreferences();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [selectedTeamAPlayerId, setSelectedTeamAPlayerId] = useState<
    string | null
  >(null);
  const [selectedTeamBPlayerId, setSelectedTeamBPlayerId] = useState<
    string | null
  >(null);
  const playersById = new Map(players.map((player) => [player.id, player]));
  const activeTeamAPlayerId = getSelectedTeamPlayerId(
    generation.teamA,
    selectedTeamAPlayerId
  );
  const activeTeamBPlayerId = getSelectedTeamPlayerId(
    generation.teamB,
    selectedTeamBPlayerId
  );

  return (
    <View style={styles.generatedCard}>
      <View style={styles.generatedTopRow}>
        <View style={styles.attendanceHeaderCopy}>
          <Text style={styles.cardTitle}>
            {strings.generation.generatedTitle} -{" "}
            {strings.generation.versionLabel} #{generation.versionNumber}
          </Text>
          <Text style={styles.helperText}>
            {generation.explanation.summary}
          </Text>
        </View>
        <Text
          accessibilityLabel={`${generation.fairnessPercentage}% ${strings.generation.fairnessLabel}`}
          style={styles.fairnessBadge}
        >
          {generation.fairnessPercentage}% {strings.generation.fairnessLabel}
        </Text>
      </View>

      {generations.length > 1 ? (
        <View style={styles.versionHistory}>
          <Text style={styles.versionHistoryTitle}>
            {strings.generation.versionHistoryTitle}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.versionPillsRow}
          >
            {generations.map((savedGeneration) => {
              const active = savedGeneration.id === generation.id;

              return (
                <Pressable
                  key={savedGeneration.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onSelectGeneration(savedGeneration)}
                  style={[
                    styles.versionPill,
                    active && styles.versionPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.versionPillText,
                      active && styles.versionPillTextActive,
                    ]}
                  >
                    {strings.generation.versionLabel} #
                    {savedGeneration.versionNumber} ·{" "}
                    {savedGeneration.fairnessPercentage}%
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.versionHistoryHint}>
            {strings.generation.versionHistoryHint}
          </Text>
        </View>
      ) : null}

      <View style={styles.generatedTeamsGrid}>
        <GeneratedTeamColumn
          playersById={playersById}
          team={generation.teamA}
        />
        <GeneratedTeamColumn
          playersById={playersById}
          team={generation.teamB}
        />
      </View>

      <View style={styles.explanationList}>
        {generation.explanation.bullets.map((bullet, index) => (
          <Text key={`${bullet}-${index}`} style={styles.explanationBullet}>
            {bullet}
          </Text>
        ))}
      </View>

      <ManualAdjustmentPanel
        generation={generation}
        manualAdjustmentState={manualAdjustmentState}
        onApply={() => {
          if (!activeTeamAPlayerId || !activeTeamBPlayerId) {
            return;
          }

          onApplyManualAdjustment(generation.id, {
            teamAPlayerId: activeTeamAPlayerId,
            teamBPlayerId: activeTeamBPlayerId,
          });
        }}
        onSelectTeamAPlayer={setSelectedTeamAPlayerId}
        onSelectTeamBPlayer={setSelectedTeamBPlayerId}
        playersById={playersById}
        selectedTeamAPlayerId={activeTeamAPlayerId}
        selectedTeamBPlayerId={activeTeamBPlayerId}
      />

      <TeamLockPanel
        generation={generation}
        onConfirm={() => onConfirmGeneration(generation.id)}
        teamLockState={teamLockState}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: detailsExpanded }}
        accessibilityLabel={
          detailsExpanded
            ? strings.generation.hideDetails
            : strings.generation.showDetails
        }
        onPress={() => setDetailsExpanded((isExpanded) => !isExpanded)}
        style={styles.detailToggle}
      >
        <Text style={styles.detailToggleText}>
          {detailsExpanded
            ? strings.generation.hideDetails
            : strings.generation.showDetails}
        </Text>
      </Pressable>

      {detailsExpanded ? (
        <View style={styles.detailPanel}>
          <Text style={styles.detailTitle}>
            {strings.generation.detailTitle}
          </Text>
          <AlgorithmDetailRow
            label={strings.generation.detailRatingGap}
            value={`${formatGenerationNumber(
              generation.scoreComponents.ratingGap
            )}/100`}
          />
          <AlgorithmDetailRow
            label={strings.generation.detailPositionMix}
            value={getBalanceSignalLabel(
              generation.scoreComponents.positionImbalance,
              strings
            )}
          />
          <AlgorithmDetailRow
            label={strings.generation.detailGoalkeeperSplit}
            value={getBalanceSignalLabel(
              generation.scoreComponents.goalkeeperImbalance,
              strings
            )}
          />
          <AlgorithmDetailRow
            label={strings.generation.detailRatingsUsed}
            value={`${generation.inputSnapshot.playerRatings.length} ${strings.generation.detailPlayers}`}
          />
        </View>
      ) : null}
    </View>
  );
}

function TeamLockPanel({
  generation,
  onConfirm,
  teamLockState,
}: {
  generation: TeamGenerationVersion;
  onConfirm: () => void;
  teamLockState: TeamLockState;
}) {
  const { strings } = usePreferences();
  const locked = generation.status === "locked";
  const locking = teamLockState === "locking";

  return (
    <View style={[styles.lockPanel, locked && styles.lockPanelOfficial]}>
      <View style={styles.manualHeader}>
        <View style={styles.attendanceHeaderCopy}>
          <Text style={styles.lockTitle}>
            {locked
              ? strings.generation.teamsLockedTitle
              : strings.generation.lockTeamsTitle}
          </Text>
          <Text style={styles.lockHint}>
            {locked
              ? strings.generation.teamsLockedHint
              : strings.generation.lockTeamsHint}
          </Text>
        </View>
        {locked ? (
          <Text style={styles.lockBadge}>
            {strings.generation.teamsLockedBadge}
          </Text>
        ) : null}
      </View>

      {!locked ? (
        <Pressable
          accessibilityRole="button"
          disabled={locking}
          onPress={onConfirm}
          style={[styles.lockButton, locking && styles.lockButtonDisabled]}
        >
          <Text
            style={[
              styles.lockButtonText,
              locking && styles.lockButtonTextDisabled,
            ]}
          >
            {locking
              ? strings.generation.lockingTeams
              : strings.generation.confirmTeams}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ManualAdjustmentPanel({
  generation,
  manualAdjustmentState,
  onApply,
  onSelectTeamAPlayer,
  onSelectTeamBPlayer,
  playersById,
  selectedTeamAPlayerId,
  selectedTeamBPlayerId,
}: {
  generation: TeamGenerationVersion;
  manualAdjustmentState: ManualAdjustmentState;
  onApply: () => void;
  onSelectTeamAPlayer: (playerId: string) => void;
  onSelectTeamBPlayer: (playerId: string) => void;
  playersById: Map<string, PlayerProfile>;
  selectedTeamAPlayerId: string | null;
  selectedTeamBPlayerId: string | null;
}) {
  const { strings } = usePreferences();
  const adjustmentUsed = Boolean(generation.manualAdjustment);
  const locked = generation.status === "locked";
  const applying = manualAdjustmentState === "applying";
  const disabled =
    adjustmentUsed ||
    locked ||
    applying ||
    !selectedTeamAPlayerId ||
    !selectedTeamBPlayerId;

  return (
    <View style={styles.manualPanel}>
      <View style={styles.manualHeader}>
        <View style={styles.attendanceHeaderCopy}>
          <Text style={styles.manualTitle}>
            {strings.generation.manualAdjustmentTitle}
          </Text>
          <Text style={styles.manualHint}>
            {adjustmentUsed
              ? strings.generation.manualAdjustmentUsed
              : locked
                ? strings.generation.manualAdjustmentLocked
                : strings.generation.manualAdjustmentHint}
          </Text>
        </View>
        {adjustmentUsed ? (
          <Text style={styles.manualBadge}>
            {strings.generation.adjustedBadge}
          </Text>
        ) : null}
      </View>

      {!adjustmentUsed && !locked ? (
        <>
          <ManualPlayerPicker
            label={`${strings.generation.teamLabel} A`}
            onSelect={onSelectTeamAPlayer}
            players={generation.teamA.players}
            playersById={playersById}
            selectedPlayerId={selectedTeamAPlayerId}
          />
          <ManualPlayerPicker
            label={`${strings.generation.teamLabel} B`}
            onSelect={onSelectTeamBPlayer}
            players={generation.teamB.players}
            playersById={playersById}
            selectedPlayerId={selectedTeamBPlayerId}
          />
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={onApply}
            style={[
              styles.manualButton,
              disabled && styles.manualButtonDisabled,
            ]}
          >
            <Text
              style={[
                styles.manualButtonText,
                disabled && styles.manualButtonTextDisabled,
              ]}
            >
              {applying
                ? strings.generation.applyingManualAdjustment
                : strings.generation.applyManualAdjustment}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function ManualPlayerPicker({
  label,
  onSelect,
  players,
  playersById,
  selectedPlayerId,
}: {
  label: string;
  onSelect: (playerId: string) => void;
  players: TeamGenerationVersion["teamA"]["players"];
  playersById: Map<string, PlayerProfile>;
  selectedPlayerId: string | null;
}) {
  const { strings } = usePreferences();

  return (
    <View style={styles.manualPicker}>
      <Text style={styles.manualPickerLabel}>{label}</Text>
      <View style={styles.manualChipRow}>
        {players.map((teamPlayer) => {
          const selected = selectedPlayerId === teamPlayer.playerId;
          const player = playersById.get(teamPlayer.playerId) ?? null;
          const displayName = getPlayerDisplayName(
            player,
            strings.profile.fallbackName
          );

          return (
            <Pressable
              key={teamPlayer.playerId}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(teamPlayer.playerId)}
              style={[
                styles.manualChip,
                selected && styles.manualChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.manualChipText,
                  selected && styles.manualChipTextSelected,
                ]}
              >
                {displayName}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function GeneratedTeamColumn({
  playersById,
  team,
}: {
  playersById: Map<string, PlayerProfile>;
  team: TeamGenerationVersion["teamA"];
}) {
  const { strings } = usePreferences();

  return (
    <View
      accessible
      accessibilityLabel={getGeneratedTeamAccessibilityLabel(
        team,
        playersById,
        strings
      )}
      style={styles.generatedTeamColumn}
    >
      <View style={styles.generatedTeamHeader}>
        <Text style={styles.generatedTeamTitle}>
          {strings.generation.teamLabel} {team.label}
        </Text>
        <Text style={styles.generatedTeamTotal}>
          {strings.generation.averageLabel}: {team.averageRating}/100
        </Text>
        <Text style={styles.generatedTeamTotal}>
          {strings.generation.totalLabel}: {team.totalRating}
        </Text>
      </View>

      {team.players.map((teamPlayer) => {
        const player = playersById.get(teamPlayer.playerId) ?? null;
        const displayName = getPlayerDisplayName(
          player,
          strings.profile.fallbackName
        );

        return (
          <View
            key={teamPlayer.playerId}
            accessible
            accessibilityLabel={getGeneratedPlayerAccessibilityLabel(
              displayName,
              teamPlayer.rating,
              team.label,
              strings
            )}
            style={styles.generatedPlayerRow}
          >
            <Text style={styles.generatedPlayerName}>{displayName}</Text>
            <Text style={styles.generatedPlayerRating}>
              {teamPlayer.rating}/100
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function AlgorithmDetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function OptionPill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.optionPill, active && styles.optionPillActive]}
    >
      <Text
        style={[styles.optionPillText, active && styles.optionPillTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function getSortedAttendances(
  attendances: FootballMatchAttendance[],
  status: FootballMatchAttendanceStatus
) {
  return attendances
    .filter((attendance) => attendance.status === status)
    .sort((left, right) => {
      if (status === "waitlisted") {
        return (
          (left.waitlistPosition ?? Number.POSITIVE_INFINITY) -
            (right.waitlistPosition ?? Number.POSITIVE_INFINITY) ||
          compareAttendanceDates(left, right)
        );
      }

      return compareAttendanceDates(left, right);
    });
}

function getGenerationBlockedReason(
  readiness: InitialPeerRatingReadiness | null,
  match: FootballMatch | null,
  generationLimitReached: boolean,
  teamsLocked: boolean,
  strings: ReturnType<typeof usePreferences>["strings"]
) {
  if (!readiness?.ready) {
    return strings.generation.blockedExplanation;
  }

  if (!match) {
    return strings.generation.noMatchForGeneration;
  }

  if (teamsLocked || match.status === "locked") {
    return strings.generation.teamsAlreadyLocked;
  }

  if (match.confirmedCount !== match.maxPlayers) {
    return `${strings.generation.confirmedPoolBlocked}: ${match.confirmedCount}/${match.maxPlayers}`;
  }

  if (generationLimitReached) {
    return strings.generation.versionLimitExplanation;
  }

  return null;
}

function getSelectedTeamPlayerId(
  team: TeamGenerationVersion["teamA"],
  selectedPlayerId: string | null
) {
  if (
    selectedPlayerId &&
    team.players.some((player) => player.playerId === selectedPlayerId)
  ) {
    return selectedPlayerId;
  }

  return team.players[0]?.playerId ?? null;
}

function selectPrimaryTeamGeneration(generations: TeamGenerationVersion[]) {
  return (
    generations.find((generation) => generation.status === "locked") ??
    generations[0] ??
    null
  );
}

function createScoreDraft(match: FootballMatch | null): ScoreDraft {
  return {
    teamAScore: match?.score ? String(match.score.teamAScore) : "",
    teamBScore: match?.score ? String(match.score.teamBScore) : "",
  };
}

function getLockedTeamPlayers(generation: TeamGenerationVersion) {
  return [
    ...generation.teamA.players.map((player) => ({
      playerId: player.playerId,
      teamLabel: "A" as const,
    })),
    ...generation.teamB.players.map((player) => ({
      playerId: player.playerId,
      teamLabel: "B" as const,
    })),
  ];
}

function createMatchEventsDraft(
  match: FootballMatch,
  teamPlayers: ReturnType<typeof getLockedTeamPlayers>
): MatchEventsDraft {
  const draft: MatchEventsDraft = {};

  for (const teamPlayer of teamPlayers) {
    const goals =
      match.events.find(
        (event) =>
          event.playerId === teamPlayer.playerId && event.kind === "goal"
      )?.count ?? 0;
    const assists =
      match.events.find(
        (event) =>
          event.playerId === teamPlayer.playerId && event.kind === "assist"
      )?.count ?? 0;

    draft[teamPlayer.playerId] = {
      goals: goals > 0 ? String(goals) : "",
      assists: assists > 0 ? String(assists) : "",
    };
  }

  return draft;
}

function parseMatchEventsDraft(
  draft: MatchEventsDraft,
  teamPlayers: ReturnType<typeof getLockedTeamPlayers>
): UpsertMatchPlayerEventsInput | null {
  const validIntegerPattern = /^\d{0,2}$/;
  const players: UpsertMatchPlayerEventsInput["players"] = [];

  for (const teamPlayer of teamPlayers) {
    const rowDraft = draft[teamPlayer.playerId] ?? {
      goals: "",
      assists: "",
    };

    if (
      !validIntegerPattern.test(rowDraft.goals) ||
      !validIntegerPattern.test(rowDraft.assists)
    ) {
      return null;
    }

    players.push({
      playerId: teamPlayer.playerId,
      goals: rowDraft.goals === "" ? 0 : Number(rowDraft.goals),
      assists: rowDraft.assists === "" ? 0 : Number(rowDraft.assists),
    });
  }

  return { players };
}

function getMvpVoteCounts(match: FootballMatch) {
  return match.mvpVotes.reduce((counts, vote) => {
    counts.set(vote.votedPlayerId, (counts.get(vote.votedPlayerId) ?? 0) + 1);

    return counts;
  }, new Map<string, number>());
}

function parseScoreDraft(draft: ScoreDraft): SubmitFinalScoreInput | null {
  const validIntegerPattern = /^\d{1,2}$/;

  if (
    !validIntegerPattern.test(draft.teamAScore) ||
    !validIntegerPattern.test(draft.teamBScore)
  ) {
    return null;
  }

  return {
    teamAScore: Number(draft.teamAScore),
    teamBScore: Number(draft.teamBScore),
  };
}

function getBalanceSignalLabel(
  value: number,
  strings: ReturnType<typeof usePreferences>["strings"]
) {
  if (value <= 0) {
    return strings.generation.detailPerfect;
  }

  if (value <= 2) {
    return strings.generation.detailGood;
  }

  return strings.generation.detailWatch;
}

function getGeneratedTeamAccessibilityLabel(
  team: TeamGenerationVersion["teamA"],
  playersById: Map<string, PlayerProfile>,
  strings: ReturnType<typeof usePreferences>["strings"]
) {
  const playerNames = team.players
    .map((teamPlayer) =>
      getPlayerDisplayName(
        playersById.get(teamPlayer.playerId) ?? null,
        strings.profile.fallbackName
      )
    )
    .join(", ");

  return [
    `${strings.generation.teamLabel} ${team.label}`,
    `${strings.generation.averageLabel} ${team.averageRating}/100`,
    `${strings.generation.totalLabel} ${team.totalRating}`,
    `${strings.generation.playersLabel}: ${playerNames}`,
  ].join(". ");
}

function getGeneratedPlayerAccessibilityLabel(
  displayName: string,
  rating: number,
  teamLabel: "A" | "B",
  strings: ReturnType<typeof usePreferences>["strings"]
) {
  return `${displayName}. ${strings.generation.teamLabel} ${teamLabel}. ${rating}/100`;
}

function formatGenerationNumber(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function compareAttendanceDates(
  left: FootballMatchAttendance,
  right: FootballMatchAttendance
) {
  return (
    new Date(left.respondedAt).getTime() -
      new Date(right.respondedAt).getTime() || left.id.localeCompare(right.id)
  );
}

function getAttendanceSectionTitle(
  status: FootballMatchAttendanceStatus,
  count: number,
  match: FootballMatch
) {
  if (status === "confirmed") {
    return `${match.confirmedCount}/${match.maxPlayers}`;
  }

  if (status === "waitlisted") {
    return `${match.waitlistCount}`;
  }

  return `${count}`;
}

function getAttendanceSectionLabel(
  status: FootballMatchAttendanceStatus,
  strings: ReturnType<typeof usePreferences>["strings"]
) {
  if (status === "confirmed") {
    return strings.matches.attendanceListConfirmed;
  }

  if (status === "waitlisted") {
    return strings.matches.attendanceListWaitlisted;
  }

  if (status === "maybe") {
    return strings.matches.attendanceListMaybe;
  }

  return strings.matches.attendanceListOut;
}

function getAttendanceStatusText(
  attendance: FootballMatchAttendance,
  strings: ReturnType<typeof usePreferences>["strings"]
) {
  if (attendance.status === "confirmed") {
    return strings.matches.attendanceStatusConfirmed;
  }

  if (attendance.status === "waitlisted") {
    return attendance.waitlistPosition
      ? `${strings.matches.attendanceStatusWaitlisted} #${attendance.waitlistPosition}`
      : strings.matches.attendanceStatusWaitlisted;
  }

  if (attendance.status === "maybe") {
    return strings.matches.attendanceStatusMaybe;
  }

  return strings.matches.attendanceStatusOut;
}

function getAttendanceStatusStyle(status: FootballMatchAttendanceStatus) {
  if (status === "confirmed") {
    return styles.attendanceStatusConfirmed;
  }

  if (status === "waitlisted") {
    return styles.attendanceStatusWaitlisted;
  }

  if (status === "maybe") {
    return styles.attendanceStatusMaybe;
  }

  return styles.attendanceStatusOut;
}

function getMissingPlayers(
  readiness: InitialPeerRatingReadiness | null,
  players: PlayerProfile[]
) {
  if (!readiness) {
    return [];
  }

  return readiness.players
    .filter((progress) => progress.ratingsNeeded > 0)
    .map((progress) => ({
      progress,
      player: players.find((player) => player.id === progress.playerId) ?? null,
    }));
}

function getPlayerDisplayName(
  player: PlayerProfile | null,
  fallbackName: string
) {
  if (!player) {
    return fallbackName;
  }

  if (player.nickname) {
    return player.nickname;
  }

  const fullName = [player.firstName, player.lastName]
    .filter(Boolean)
    .join(" ");

  return fullName.length > 0 ? fullName : fallbackName;
}

function createDefaultMatchDraft(): MatchDraft {
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 7);
  startsAt.setHours(20, 0, 0, 0);

  const attendanceDeadlineAt = new Date(startsAt);
  attendanceDeadlineAt.setHours(attendanceDeadlineAt.getHours() - 2);

  return {
    title: "Foot 5",
    date: formatDateInput(startsAt),
    time: formatTimeInput(startsAt),
    location: "",
    deadlineDate: formatDateInput(attendanceDeadlineAt),
    deadlineTime: formatTimeInput(attendanceDeadlineAt),
    playersPerTeam: 5,
    generatorStyleOverride: null,
    goalkeeperModeOverride: null,
  };
}

function parseLocalDateTime(dateValue: string, timeValue: string): Date | null {
  const parsedDate = new Date(`${dateValue}T${timeValue}:00`);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatDateInput(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatTimeInput(date: Date) {
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join(":");
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07110D",
  },
  content: {
    padding: 20,
    paddingBottom: 44,
    gap: 18,
  },
  header: {
    gap: 8,
    paddingTop: 8,
  },
  kicker: {
    color: "#35C77B",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  title: {
    color: "#F4F7F2",
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    color: "#8D96A5",
    fontSize: 15,
    lineHeight: 21,
  },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderWidth: 1,
    borderColor: "#1D2A25",
    borderRadius: 24,
    backgroundColor: "#10161D",
    padding: 18,
  },
  groupLabel: {
    color: "#8D96A5",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  groupName: {
    color: "#F4F7F2",
    fontSize: 18,
    fontWeight: "900",
  },
  reloadButton: {
    borderWidth: 1,
    borderColor: "#1F513A",
    borderRadius: 999,
    backgroundColor: "#113B2B",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  reloadButtonText: {
    color: "#72E6A4",
    fontSize: 13,
    fontWeight: "900",
  },
  statusText: {
    color: "#8D96A5",
    fontSize: 15,
    fontWeight: "700",
  },
  errorText: {
    color: "#FF6464",
    fontSize: 15,
    fontWeight: "800",
  },
  successText: {
    color: "#72E6A4",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  card: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#1D2A25",
    borderRadius: 24,
    backgroundColor: "#10161D",
    padding: 18,
  },
  attendanceCard: {
    gap: 16,
    borderWidth: 1,
    borderColor: "#1F513A",
    borderRadius: 26,
    backgroundColor: "#0B1B15",
    padding: 18,
  },
  attendanceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  attendanceHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  attendanceTotalBadge: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#334D3E",
    borderRadius: 999,
    backgroundColor: "#113B2B",
    color: "#72E6A4",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  attendanceSection: {
    gap: 9,
  },
  attendanceSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  attendanceSectionTitle: {
    color: "#F4F7F2",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  attendanceSectionCount: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#17251F",
    color: "#AEB8C7",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  attendanceRows: {
    gap: 8,
  },
  attendanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderColor: "#20342B",
    borderRadius: 18,
    backgroundColor: "#101A16",
    padding: 11,
  },
  attendanceAvatarWrap: {
    width: 42,
    height: 42,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#163626",
  },
  attendanceAvatar: {
    width: "100%",
    height: "100%",
  },
  attendanceAvatarFallback: {
    color: "#72E6A4",
    fontSize: 18,
    fontWeight: "900",
  },
  attendancePlayerBody: {
    flex: 1,
    gap: 2,
  },
  attendancePlayerName: {
    color: "#F4F7F2",
    fontSize: 15,
    fontWeight: "900",
  },
  attendancePlayerMeta: {
    color: "#8D96A5",
    fontSize: 12,
    fontWeight: "800",
  },
  attendanceStatusBadge: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  attendanceStatusConfirmed: {
    borderColor: "#1F513A",
    backgroundColor: "#113B2B",
    color: "#72E6A4",
  },
  attendanceStatusWaitlisted: {
    borderColor: "#4C3E18",
    backgroundColor: "#332711",
    color: "#F9C846",
  },
  attendanceStatusMaybe: {
    borderColor: "#27435D",
    backgroundColor: "#142638",
    color: "#8EC9FF",
  },
  attendanceStatusOut: {
    borderColor: "#4E2424",
    backgroundColor: "#351717",
    color: "#FF8E8E",
  },
  attendanceEmptyText: {
    borderWidth: 1,
    borderColor: "#20342B",
    borderRadius: 16,
    backgroundColor: "#0D1713",
    color: "#748076",
    fontSize: 12,
    fontWeight: "800",
    padding: 11,
  },
  finalScoreCard: {
    gap: 15,
    borderWidth: 1,
    borderColor: "#27435D",
    borderRadius: 26,
    backgroundColor: "#101923",
    padding: 18,
  },
  matchEventsCard: {
    gap: 15,
    borderWidth: 1,
    borderColor: "#1F513A",
    borderRadius: 26,
    backgroundColor: "#0B1B15",
    padding: 18,
  },
  eventSummaryList: {
    gap: 7,
    borderWidth: 1,
    borderColor: "#20342B",
    borderRadius: 18,
    backgroundColor: "#101A16",
    padding: 12,
  },
  eventSummaryText: {
    color: "#CFE8D8",
    fontSize: 13,
    fontWeight: "900",
  },
  eventRows: {
    gap: 9,
  },
  eventInputHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 2,
  },
  eventInputHeaderSpacer: {
    flex: 1,
  },
  eventInputHeader: {
    width: 58,
    color: "#72E6A4",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textAlign: "center",
    textTransform: "uppercase",
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "#20342B",
    borderRadius: 18,
    backgroundColor: "#101A16",
    padding: 11,
  },
  eventPlayerCopy: {
    flex: 1,
    gap: 2,
  },
  eventPlayerName: {
    color: "#F4F7F2",
    fontSize: 14,
    fontWeight: "900",
  },
  eventPlayerMeta: {
    color: "#8D96A5",
    fontSize: 12,
    fontWeight: "800",
  },
  eventInput: {
    width: 58,
    borderWidth: 1,
    borderColor: "#25313D",
    borderRadius: 14,
    backgroundColor: "#141A22",
    color: "#F4F7F2",
    fontSize: 15,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 10,
    textAlign: "center",
  },
  mvpVoteCard: {
    gap: 15,
    borderWidth: 1,
    borderColor: "#6B5318",
    borderRadius: 26,
    backgroundColor: "#181611",
    padding: 18,
  },
  mvpChosenText: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#6B5318",
    borderRadius: 16,
    backgroundColor: "#332711",
    color: "#F9C846",
    fontSize: 13,
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mvpRows: {
    gap: 9,
  },
  mvpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "#3A321C",
    borderRadius: 18,
    backgroundColor: "#211C12",
    padding: 11,
  },
  mvpRowDisabled: {
    opacity: 0.55,
  },
  mvpPlayerCopy: {
    flex: 1,
    gap: 2,
  },
  mvpPlayerName: {
    color: "#F4F7F2",
    fontSize: 14,
    fontWeight: "900",
  },
  mvpPlayerMeta: {
    color: "#C6B57B",
    fontSize: 12,
    fontWeight: "800",
  },
  mvpCountBadge: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#6B5318",
    borderRadius: 999,
    backgroundColor: "#332711",
    color: "#F9C846",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  mvpActionText: {
    color: "#72E6A4",
    fontSize: 12,
    fontWeight: "900",
  },
  scoreBoard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: "#25313D",
    borderRadius: 22,
    backgroundColor: "#0B1118",
    padding: 16,
  },
  scoreTeam: {
    flex: 1,
    alignItems: "center",
    gap: 5,
  },
  scoreTeamLabel: {
    color: "#8EC9FF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  scoreNumber: {
    color: "#F4F7F2",
    fontSize: 42,
    fontWeight: "900",
  },
  scoreSeparator: {
    color: "#8D96A5",
    fontSize: 28,
    fontWeight: "900",
  },
  scoreInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  scoreInputColumn: {
    flex: 1,
    gap: 8,
  },
  generatedCard: {
    gap: 16,
    borderWidth: 1,
    borderColor: "#4C3E18",
    borderRadius: 28,
    backgroundColor: "#181611",
    padding: 18,
  },
  generatedTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  fairnessBadge: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#6B5318",
    borderRadius: 999,
    backgroundColor: "#332711",
    color: "#F9C846",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  versionHistory: {
    gap: 9,
    borderWidth: 1,
    borderColor: "#2D2A1E",
    borderRadius: 20,
    backgroundColor: "#10161D",
    padding: 12,
  },
  versionHistoryTitle: {
    color: "#F4F7F2",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  versionPillsRow: {
    gap: 8,
    paddingRight: 8,
  },
  versionPill: {
    borderWidth: 1,
    borderColor: "#25313D",
    borderRadius: 999,
    backgroundColor: "#171E27",
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  versionPillActive: {
    borderColor: "#F9C846",
    backgroundColor: "#332711",
  },
  versionPillText: {
    color: "#AEB8C7",
    fontSize: 12,
    fontWeight: "900",
  },
  versionPillTextActive: {
    color: "#F9C846",
  },
  versionHistoryHint: {
    color: "#8D96A5",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  generatedTeamsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  generatedTeamColumn: {
    flex: 1,
    gap: 9,
    borderWidth: 1,
    borderColor: "#2D2A1E",
    borderRadius: 20,
    backgroundColor: "#10161D",
    padding: 12,
  },
  generatedTeamHeader: {
    gap: 3,
  },
  generatedTeamTitle: {
    color: "#F4F7F2",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  generatedTeamTotal: {
    color: "#F9C846",
    fontSize: 12,
    fontWeight: "900",
  },
  generatedPlayerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#171E27",
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  generatedPlayerName: {
    flex: 1,
    color: "#F4F7F2",
    fontSize: 12,
    fontWeight: "900",
  },
  generatedPlayerRating: {
    color: "#AEB8C7",
    fontSize: 11,
    fontWeight: "900",
  },
  explanationList: {
    gap: 7,
  },
  explanationBullet: {
    color: "#C6B57B",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  lockPanel: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#1F513A",
    borderRadius: 20,
    backgroundColor: "#0B1B15",
    padding: 14,
  },
  lockPanelOfficial: {
    borderColor: "#35C77B",
    backgroundColor: "#0C2118",
  },
  lockTitle: {
    color: "#F4F7F2",
    fontSize: 15,
    fontWeight: "900",
  },
  lockHint: {
    color: "#AEB8C7",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  lockBadge: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#35C77B",
    borderRadius: 999,
    backgroundColor: "#113B2B",
    color: "#72E6A4",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  lockButton: {
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "#35C77B",
    paddingVertical: 13,
  },
  lockButtonDisabled: {
    backgroundColor: "#1C2530",
  },
  lockButtonText: {
    color: "#06110C",
    fontSize: 13,
    fontWeight: "900",
  },
  lockButtonTextDisabled: {
    color: "#8D96A5",
  },
  manualPanel: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#2D2A1E",
    borderRadius: 20,
    backgroundColor: "#10161D",
    padding: 14,
  },
  manualHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  manualTitle: {
    color: "#F4F7F2",
    fontSize: 15,
    fontWeight: "900",
  },
  manualHint: {
    color: "#AEB8C7",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  manualBadge: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1F513A",
    borderRadius: 999,
    backgroundColor: "#113B2B",
    color: "#72E6A4",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  manualPicker: {
    gap: 7,
  },
  manualPickerLabel: {
    color: "#F9C846",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  manualChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  manualChip: {
    borderWidth: 1,
    borderColor: "#25313D",
    borderRadius: 999,
    backgroundColor: "#171E27",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  manualChipSelected: {
    borderColor: "#F9C846",
    backgroundColor: "#332711",
  },
  manualChipText: {
    color: "#AEB8C7",
    fontSize: 12,
    fontWeight: "900",
  },
  manualChipTextSelected: {
    color: "#F9C846",
  },
  manualButton: {
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "#F9C846",
    paddingVertical: 13,
  },
  manualButtonDisabled: {
    backgroundColor: "#1C2530",
  },
  manualButtonText: {
    color: "#141006",
    fontSize: 13,
    fontWeight: "900",
  },
  manualButtonTextDisabled: {
    color: "#8D96A5",
  },
  detailToggle: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#6B5318",
    borderRadius: 16,
    backgroundColor: "#241C0D",
    paddingVertical: 12,
  },
  detailToggleText: {
    color: "#F9C846",
    fontSize: 13,
    fontWeight: "900",
  },
  detailPanel: {
    gap: 10,
    borderWidth: 1,
    borderColor: "#2D2A1E",
    borderRadius: 20,
    backgroundColor: "#10161D",
    padding: 14,
  },
  detailTitle: {
    color: "#F4F7F2",
    fontSize: 14,
    fontWeight: "900",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 14,
    backgroundColor: "#171E27",
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  detailLabel: {
    flex: 1,
    color: "#AEB8C7",
    fontSize: 12,
    fontWeight: "800",
  },
  detailValue: {
    color: "#72E6A4",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
  },
  cardTitle: {
    color: "#F4F7F2",
    fontSize: 20,
    fontWeight: "900",
  },
  formGroup: {
    gap: 8,
  },
  formRow: {
    flexDirection: "row",
    gap: 10,
  },
  formColumn: {
    flex: 1,
    gap: 8,
  },
  fieldLabel: {
    color: "#F4F7F2",
    fontSize: 13,
    fontWeight: "900",
  },
  input: {
    borderWidth: 1,
    borderColor: "#25313D",
    borderRadius: 18,
    backgroundColor: "#141A22",
    color: "#F4F7F2",
    fontSize: 15,
    fontWeight: "800",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionPill: {
    borderWidth: 1,
    borderColor: "#25313D",
    borderRadius: 999,
    backgroundColor: "#141A22",
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  optionPillActive: {
    borderColor: "#F9C846",
    backgroundColor: "#332711",
  },
  optionPillText: {
    color: "#AEB8C7",
    fontSize: 12,
    fontWeight: "900",
  },
  optionPillTextActive: {
    color: "#F9C846",
  },
  submitButton: {
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#35C77B",
    paddingVertical: 15,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: "#06110C",
    fontSize: 15,
    fontWeight: "900",
  },
  gateCard: {
    gap: 15,
    borderWidth: 1,
    borderColor: "#4C3E18",
    borderRadius: 30,
    backgroundColor: "#211C12",
    padding: 20,
  },
  gateCardReady: {
    borderColor: "#1F513A",
    backgroundColor: "#0C2118",
  },
  gateTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  gateCopy: {
    flex: 1,
    gap: 5,
  },
  gateKicker: {
    color: "#F9C846",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  gateTitle: {
    color: "#F4F7F2",
    fontSize: 23,
    fontWeight: "900",
  },
  gatePercent: {
    color: "#F9C846",
    fontSize: 30,
    fontWeight: "900",
  },
  progressTrack: {
    height: 10,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#17251F",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#35C77B",
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statPill: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#113B2B",
    color: "#72E6A4",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  helperText: {
    color: "#AEB8C7",
    fontSize: 14,
    lineHeight: 20,
  },
  generateButton: {
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#35C77B",
    paddingVertical: 15,
  },
  generateButtonDisabled: {
    backgroundColor: "#1C2530",
  },
  generateButtonText: {
    color: "#06110C",
    fontSize: 16,
    fontWeight: "900",
  },
  generateButtonTextDisabled: {
    color: "#8D96A5",
  },
  lockedExplanation: {
    color: "#C6B57B",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    flexGrow: 1,
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#F9C846",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#141006",
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryButton: {
    flexGrow: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F513A",
    borderRadius: 18,
    backgroundColor: "#113B2B",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#72E6A4",
    fontSize: 14,
    fontWeight: "900",
  },
  missingList: {
    gap: 10,
  },
  missingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: "#25313D",
    borderRadius: 18,
    backgroundColor: "#141A22",
    padding: 14,
  },
  missingName: {
    color: "#F4F7F2",
    fontSize: 16,
    fontWeight: "900",
  },
  missingMeta: {
    color: "#8D96A5",
    fontSize: 12,
    fontWeight: "800",
  },
  missingBadge: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#332711",
    color: "#F9C846",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
});

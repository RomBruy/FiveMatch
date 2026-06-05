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
  type PlayerProfile,
  type TeamGenerationVersion,
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
  createFootballMatch,
  generateTeamVersion,
  getInitialPeerRatingReadiness,
  getNextFootballMatch,
  listTeamGenerations,
  listCurrentUserGroups,
  listGroupPlayers,
  submitMatchAttendance,
} from "@/api/client";
import { NextMatchCard } from "@/features/matches/next-match-card";
import { usePreferences } from "@/features/preferences/preferences-context";

type GateLoadState = "loading" | "ready" | "noGroup" | "error";
type CreateMatchState = "idle" | "creating" | "created" | "error";
type GenerationState = "idle" | "generating" | "generated" | "error";
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
      setPlayers(rosterResponse.data.players);
      setTeamGenerations(savedGenerations);
      setTeamGeneration(savedGenerations[0] ?? null);
      setGenerationState(savedGenerations.length > 0 ? "generated" : "idle");
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
  const generationPoolReady =
    Boolean(readiness?.ready) &&
    (nextMatch ? nextMatch.confirmedCount === nextMatch.maxPlayers : false) &&
    !generationLimitReached;
  const generationBlockedReason = getGenerationBlockedReason(
    readiness,
    nextMatch,
    generationLimitReached,
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
                onSelectGeneration={setTeamGeneration}
                players={players}
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

function GeneratedTeamsCard({
  generation,
  generations,
  onSelectGeneration,
  players,
}: {
  generation: TeamGenerationVersion;
  generations: TeamGenerationVersion[];
  onSelectGeneration: (generation: TeamGenerationVersion) => void;
  players: PlayerProfile[];
}) {
  const { strings } = usePreferences();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const playersById = new Map(players.map((player) => [player.id, player]));

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
  strings: ReturnType<typeof usePreferences>["strings"]
) {
  if (!readiness?.ready) {
    return strings.generation.blockedExplanation;
  }

  if (!match) {
    return strings.generation.noMatchForGeneration;
  }

  if (match.confirmedCount !== match.maxPlayers) {
    return `${strings.generation.confirmedPoolBlocked}: ${match.confirmedCount}/${match.maxPlayers}`;
  }

  if (generationLimitReached) {
    return strings.generation.versionLimitExplanation;
  }

  return null;
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

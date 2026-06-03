import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import {
  groupGeneratorStyles,
  groupGoalkeeperModes,
  type FootballGroup,
  type FootballMatch,
  type FootballMatchAttendanceResponse,
  type GroupGeneratorStyle,
  type GroupGoalkeeperMode,
  type InitialPeerRatingReadiness,
  type PlayerProfile,
} from "@fit-five/shared";
import { useEffect, useState } from "react";
import {
  Pressable,
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
  getInitialPeerRatingReadiness,
  getNextFootballMatch,
  listCurrentUserGroups,
  listGroupPlayers,
  submitMatchAttendance,
} from "@/api/client";
import { NextMatchCard } from "@/features/matches/next-match-card";
import { usePreferences } from "@/features/preferences/preferences-context";

type GateLoadState = "loading" | "ready" | "noGroup" | "error";
type CreateMatchState = "idle" | "creating" | "created" | "error";
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
        setLoadState("noGroup");
        return;
      }

      const [readinessResponse, rosterResponse, nextMatchResponse] =
        await Promise.all([
          getInitialPeerRatingReadiness(token, firstGroup.id),
          listGroupPlayers(token, firstGroup.id),
          getNextFootballMatch(token, firstGroup.id),
        ]);

      setActiveGroup(firstGroup);
      setReadiness(readinessResponse.data.readiness);
      setNextMatch(nextMatchResponse.data.match);
      setPlayers(rosterResponse.data.players);
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

  function handleGeneratePlaceholder() {
    setActionMessage(strings.generation.readyActionHint);
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
          <NextMatchCard
            match={nextMatch}
            responseState={attendanceState}
            onRespond={handleSubmitAttendance}
          />
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
              readiness={readiness}
              onGenerate={handleGeneratePlaceholder}
            />

            {actionMessage ? (
              <Text style={styles.successText}>{actionMessage}</Text>
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
  readiness,
  onGenerate,
}: {
  readiness: InitialPeerRatingReadiness;
  onGenerate: () => void;
}) {
  const { strings } = usePreferences();

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
      </View>

      <Text style={styles.helperText}>
        {strings.generation.temporaryPoolNote}
      </Text>

      <Pressable
        disabled={!readiness.ready}
        onPress={onGenerate}
        style={[
          styles.generateButton,
          !readiness.ready && styles.generateButtonDisabled,
        ]}
      >
        <Text
          style={[
            styles.generateButtonText,
            !readiness.ready && styles.generateButtonTextDisabled,
          ]}
        >
          {readiness.ready
            ? strings.generation.generateTeams
            : strings.generation.generateLocked}
        </Text>
      </Pressable>

      {!readiness.ready ? (
        <Text style={styles.lockedExplanation}>
          {strings.generation.blockedExplanation}
        </Text>
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

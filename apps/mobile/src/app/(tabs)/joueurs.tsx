import { useAuth } from "@clerk/expo";
import {
  goalkeeperInitialPeerRatingAttributes,
  standardInitialPeerRatingAttributes,
  type FootballGroup,
  type InitialPeerRating,
  type InitialPeerRatingAttribute,
  type InitialPeerRatingAttributeSet,
  type InitialPeerRatingValues,
  type PlayerProfile,
} from "@fit-five/shared";
import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getMyPlayerProfile,
  listCurrentUserGroups,
  listGroupPlayers,
  listMyInitialPeerRatings,
  submitInitialPeerRating,
  updateInitialPeerRating,
} from "@/api/client";
import { usePreferences } from "@/features/preferences/preferences-context";

type RosterLoadState = "loading" | "ready" | "noGroup" | "error";
type SubmitState = "idle" | "submitting" | "saved" | "error";
type SubmitError = "duplicate" | "self" | "locked" | "generic";

const ratingLevels = [0, 25, 50, 75, 100] as const;

export default function JoueursScreen() {
  const { getToken } = useAuth();
  const { strings } = usePreferences();
  const [activeGroup, setActiveGroup] = useState<FootballGroup | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [myPlayer, setMyPlayer] = useState<PlayerProfile | null>(null);
  const [submittedRatings, setSubmittedRatings] = useState<InitialPeerRating[]>(
    []
  );
  const [activeRatingPlayer, setActiveRatingPlayer] =
    useState<PlayerProfile | null>(null);
  const [activeRating, setActiveRating] = useState<InitialPeerRating | null>(
    null
  );
  const [ratingValues, setRatingValues] = useState<InitialPeerRatingValues>({});
  const [loadState, setLoadState] = useState<RosterLoadState>("loading");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<SubmitError>("generic");
  const [lastSaveWasUpdate, setLastSaveWasUpdate] = useState(false);

  async function loadRoster() {
    setLoadState("loading");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const groupsResponse = await listCurrentUserGroups(token);
      const firstGroup = groupsResponse.data.groups[0];

      if (!firstGroup) {
        setActiveGroup(null);
        setPlayers([]);
        setMyPlayer(null);
        setSubmittedRatings([]);
        setLoadState("noGroup");
        return;
      }

      const [profileResponse, rosterResponse] = await Promise.all([
        getMyPlayerProfile(token, firstGroup.id),
        listGroupPlayers(token, firstGroup.id),
      ]);
      const currentPlayer = profileResponse.data.player;
      const ratingsResponse = currentPlayer
        ? await listMyInitialPeerRatings(token, firstGroup.id)
        : null;

      setActiveGroup(firstGroup);
      setMyPlayer(currentPlayer);
      setPlayers(rosterResponse.data.players);
      setSubmittedRatings(ratingsResponse?.data.ratings ?? []);
      setLoadState("ready");
    } catch (error) {
      console.warn("Unable to load player roster", error);
      setLoadState("error");
    }
  }

  useEffect(() => {
    void loadRoster();
  }, [getToken]);

  function handleOpenRating(
    player: PlayerProfile,
    rating: InitialPeerRating | null
  ) {
    if (rating?.lockedAt) {
      return;
    }

    const attributeSet =
      rating?.attributeSet ?? getAttributeSetForPlayer(player);
    const attributes = getAttributesForSet(attributeSet);

    setActiveRatingPlayer(player);
    setActiveRating(rating);
    setRatingValues(
      rating
        ? getValuesFromRating(rating)
        : Object.fromEntries(attributes.map((attribute) => [attribute, 50]))
    );
    setSubmitState("idle");
  }

  function handleRatingValueChange(
    attribute: InitialPeerRatingAttribute,
    value: number
  ) {
    setRatingValues((currentValues) => ({
      ...currentValues,
      [attribute]: value,
    }));
  }

  async function handleSubmitRating() {
    if (!activeGroup || !activeRatingPlayer) {
      return;
    }

    setSubmitState("submitting");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = activeRating
        ? await updateInitialPeerRating(
            token,
            activeGroup.id,
            activeRating.id,
            {
              values: ratingValues,
            }
          )
        : await submitInitialPeerRating(token, activeGroup.id, {
            ratedPlayerId: activeRatingPlayer.id,
            values: ratingValues,
          });
      const savedRating = response.data.rating;

      setSubmittedRatings((currentRatings) => {
        const existingIndex = currentRatings.findIndex(
          (rating) => rating.id === savedRating.id
        );

        if (existingIndex === -1) {
          return [...currentRatings, savedRating];
        }

        return currentRatings.map((rating) =>
          rating.id === savedRating.id ? savedRating : rating
        );
      });
      setLastSaveWasUpdate(Boolean(activeRating));
      setSubmitState("saved");
      setActiveRatingPlayer(null);
      setActiveRating(null);
      setRatingValues({});
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (message.includes("409")) {
        setSubmitError(activeRating ? "locked" : "duplicate");
      } else if (message.includes("400")) {
        setSubmitError("self");
      } else {
        setSubmitError("generic");
      }

      setSubmitState("error");
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>{strings.navigation.players}</Text>
          <Text style={styles.title}>{strings.players.rosterTitle}</Text>
          <Text style={styles.subtitle}>{strings.players.rosterSubtitle}</Text>
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
              onPress={() => void loadRoster()}
              style={styles.reloadButton}
            >
              <Text style={styles.reloadButtonText}>
                {strings.players.reloadRoster}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {loadState === "loading" ? (
          <Text style={styles.statusText}>{strings.auth.loadingSession}</Text>
        ) : null}

        {loadState === "noGroup" ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {strings.players.rosterEmptyTitle}
            </Text>
            <Text style={styles.subtitle}>{strings.players.noGroup}</Text>
          </View>
        ) : null}

        {loadState === "error" ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {strings.players.rosterEmptyTitle}
            </Text>
            <Text style={styles.errorText}>{strings.players.profileError}</Text>
          </View>
        ) : null}

        {loadState === "ready" && !myPlayer ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>
              {strings.ratings.initialTitle}
            </Text>
            <Text style={styles.warningText}>
              {strings.ratings.noPlayerProfile}
            </Text>
          </View>
        ) : null}

        {loadState === "ready" && activeRatingPlayer ? (
          <RatingComposer
            player={activeRatingPlayer}
            rating={activeRating}
            values={ratingValues}
            submitState={submitState}
            submitError={submitError}
            onCancel={() => {
              setActiveRatingPlayer(null);
              setActiveRating(null);
              setSubmitState("idle");
            }}
            onChange={handleRatingValueChange}
            onSubmit={handleSubmitRating}
          />
        ) : null}

        {loadState === "ready" && submitState === "saved" ? (
          <Text style={styles.successText}>
            {lastSaveWasUpdate
              ? strings.ratings.updated
              : strings.ratings.saved}
          </Text>
        ) : null}

        {loadState === "ready" && players.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {strings.players.rosterEmptyTitle}
            </Text>
            <Text style={styles.subtitle}>
              {strings.players.rosterEmptySubtitle}
            </Text>
          </View>
        ) : null}

        {loadState === "ready" && players.length > 0 ? (
          <View style={styles.rosterList}>
            <Text style={styles.countText}>
              {players.length} {strings.navigation.players.toLowerCase()}
            </Text>
            {players.map((player) => {
              const isSelf = player.id === myPlayer?.id;
              const submittedRating =
                submittedRatings.find(
                  (rating) => rating.ratedPlayerId === player.id
                ) ?? null;
              const isLocked = Boolean(submittedRating?.lockedAt);

              return (
                <PlayerRosterCard
                  key={player.id}
                  isSelf={isSelf}
                  player={player}
                  rating={submittedRating}
                  ratingEnabled={Boolean(myPlayer) && !isSelf && !isLocked}
                  onRate={handleOpenRating}
                />
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type PlayerRosterCardProps = {
  player: PlayerProfile;
  isSelf: boolean;
  rating: InitialPeerRating | null;
  ratingEnabled: boolean;
  onRate: (player: PlayerProfile, rating: InitialPeerRating | null) => void;
};

function PlayerRosterCard({
  player,
  isSelf,
  rating,
  ratingEnabled,
  onRate,
}: PlayerRosterCardProps) {
  const { strings } = usePreferences();
  const isRated = Boolean(rating);
  const isLocked = Boolean(rating?.lockedAt);
  const displayName = getPlayerDisplayName(
    player,
    strings.profile.fallbackName
  );
  const fullName = [player.firstName, player.lastName]
    .filter(Boolean)
    .join(" ");
  const subtitle =
    player.nickname && fullName.length > 0
      ? fullName
      : (player.clubDeFormation ?? strings.players.profileTitle);
  const preferredStyle = player.preferredStyle
    ? strings.players.preferredStyleOptions[player.preferredStyle]
    : null;
  const dominantFoot = player.dominantFoot
    ? strings.players.dominantFootOptions[player.dominantFoot]
    : null;

  return (
    <View style={styles.playerCard}>
      <View style={styles.playerAvatarWrap}>
        {player.photoUrl ? (
          <Image
            source={{ uri: player.photoUrl }}
            style={styles.playerAvatar}
          />
        ) : (
          <Text style={styles.playerAvatarFallback}>
            {displayName.slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>

      <View style={styles.playerBody}>
        <View style={styles.playerTitleRow}>
          <Text style={styles.playerName}>{displayName}</Text>
          {player.jerseyNumber !== null ? (
            <Text style={styles.jerseyBadge}>
              {strings.players.jerseyNumber} {player.jerseyNumber}
            </Text>
          ) : null}
        </View>
        <Text style={styles.playerSubtitle}>{subtitle}</Text>

        <View style={styles.chipRow}>
          {preferredStyle ? (
            <Text style={styles.profileChip}>{preferredStyle}</Text>
          ) : null}
          {dominantFoot ? (
            <Text style={styles.profileChip}>{dominantFoot}</Text>
          ) : null}
          {player.isComplete ? (
            <Text style={styles.completeChip}>
              {strings.players.completeTitle}
            </Text>
          ) : (
            <Text style={styles.missingChip}>
              {strings.players.missingTitle}: {player.missingFields.length}
            </Text>
          )}
        </View>

        <Pressable
          disabled={!ratingEnabled}
          onPress={() => onRate(player, rating)}
          style={[
            styles.ratingButton,
            !ratingEnabled && styles.ratingButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.ratingButtonText,
              !ratingEnabled && styles.ratingButtonTextDisabled,
            ]}
          >
            {isSelf
              ? strings.ratings.selfRating
              : isLocked
                ? strings.ratings.lockedRating
                : isRated
                  ? strings.ratings.editRating
                  : strings.ratings.ratePlayer}
          </Text>
        </Pressable>

        {isLocked ? (
          <Text style={styles.lockedHelp}>{strings.ratings.lockedHelp}</Text>
        ) : null}
      </View>
    </View>
  );
}

type RatingComposerProps = {
  player: PlayerProfile;
  rating: InitialPeerRating | null;
  values: InitialPeerRatingValues;
  submitState: SubmitState;
  submitError: SubmitError;
  onCancel: () => void;
  onChange: (attribute: InitialPeerRatingAttribute, value: number) => void;
  onSubmit: () => void;
};

function RatingComposer({
  player,
  rating,
  values,
  submitState,
  submitError,
  onCancel,
  onChange,
  onSubmit,
}: RatingComposerProps) {
  const { strings } = usePreferences();
  const displayName = getPlayerDisplayName(
    player,
    strings.profile.fallbackName
  );
  const attributeSet = rating?.attributeSet ?? getAttributeSetForPlayer(player);
  const attributes = getAttributesForSet(attributeSet);

  return (
    <View style={styles.ratingCard}>
      <View style={styles.ratingHeader}>
        <View style={styles.ratingHeaderText}>
          <Text style={styles.ratingTitle}>{strings.ratings.initialTitle}</Text>
          <Text style={styles.ratingSubtitle}>
            {displayName} ·{" "}
            {attributeSet === "goalkeeper"
              ? strings.ratings.goalkeeperHint
              : strings.ratings.standardHint}
          </Text>
        </View>
        <Pressable onPress={onCancel} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>×</Text>
        </Pressable>
      </View>

      <Text style={styles.ratingHelp}>{strings.ratings.initialSubtitle}</Text>

      {attributes.map((attribute) => (
        <View key={attribute} style={styles.ratingAttribute}>
          <View style={styles.ratingAttributeHeader}>
            <Text style={styles.ratingAttributeLabel}>
              {strings.ratings.attributes[attribute]}
            </Text>
            <Text style={styles.ratingAttributeValue}>
              {values[attribute] ?? 50}
              {strings.ratings.valueSuffix}
            </Text>
          </View>
          <View style={styles.levelRow}>
            {ratingLevels.map((level) => {
              const isSelected = (values[attribute] ?? 50) === level;

              return (
                <Pressable
                  key={level}
                  onPress={() => onChange(attribute, level)}
                  style={[
                    styles.levelButton,
                    isSelected && styles.levelButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.levelButtonText,
                      isSelected && styles.levelButtonTextSelected,
                    ]}
                  >
                    {level}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <Pressable
        disabled={submitState === "submitting"}
        onPress={() => void onSubmit()}
        style={[
          styles.primaryButton,
          submitState === "submitting" && styles.primaryButtonDisabled,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {submitState === "submitting"
            ? strings.ratings.submitting
            : rating
              ? strings.ratings.updateButton
              : strings.ratings.submitButton}
        </Text>
      </Pressable>

      {submitState === "error" ? (
        <Text style={styles.errorText}>
          {submitError === "duplicate"
            ? strings.ratings.duplicateError
            : submitError === "self"
              ? strings.ratings.selfRatingError
              : submitError === "locked"
                ? strings.ratings.lockedError
                : strings.ratings.error}
        </Text>
      ) : null}
    </View>
  );
}

function getPlayerDisplayName(player: PlayerProfile, fallbackName: string) {
  if (player.nickname) {
    return player.nickname;
  }

  const fullName = [player.firstName, player.lastName]
    .filter(Boolean)
    .join(" ");

  return fullName.length > 0 ? fullName : fallbackName;
}

function getAttributeSetForPlayer(
  player: PlayerProfile
): InitialPeerRatingAttributeSet {
  return player.preferredStyle === "goalkeeper" ? "goalkeeper" : "standard";
}

function getAttributesForSet(attributeSet: InitialPeerRatingAttributeSet) {
  return attributeSet === "goalkeeper"
    ? goalkeeperInitialPeerRatingAttributes
    : standardInitialPeerRatingAttributes;
}

function getValuesFromRating(
  rating: InitialPeerRating
): InitialPeerRatingValues {
  const attributes = getAttributesForSet(rating.attributeSet);

  return Object.fromEntries(
    attributes.map((attribute) => [attribute, rating[attribute] ?? 50])
  ) as InitialPeerRatingValues;
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
    fontSize: 15,
    fontWeight: "900",
  },
  emptyCard: {
    gap: 8,
    borderWidth: 1,
    borderColor: "#1D2A25",
    borderRadius: 24,
    backgroundColor: "#10161D",
    padding: 20,
  },
  emptyTitle: {
    color: "#F4F7F2",
    fontSize: 20,
    fontWeight: "900",
  },
  warningCard: {
    gap: 8,
    borderWidth: 1,
    borderColor: "#4C3E18",
    borderRadius: 24,
    backgroundColor: "#211C12",
    padding: 18,
  },
  warningTitle: {
    color: "#F9C846",
    fontSize: 18,
    fontWeight: "900",
  },
  warningText: {
    color: "#C6B57B",
    fontSize: 14,
    lineHeight: 20,
  },
  rosterList: {
    gap: 12,
  },
  countText: {
    color: "#8D96A5",
    fontSize: 14,
    fontWeight: "800",
  },
  playerCard: {
    flexDirection: "row",
    gap: 14,
    borderWidth: 1,
    borderColor: "#1D2A25",
    borderRadius: 24,
    backgroundColor: "#10161D",
    padding: 14,
  },
  playerAvatarWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 66,
    height: 66,
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "#113B2B",
  },
  playerAvatar: {
    width: "100%",
    height: "100%",
  },
  playerAvatarFallback: {
    color: "#72E6A4",
    fontSize: 28,
    fontWeight: "900",
  },
  playerBody: {
    flex: 1,
    gap: 8,
  },
  playerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  playerName: {
    flex: 1,
    color: "#F4F7F2",
    fontSize: 19,
    fontWeight: "900",
  },
  playerSubtitle: {
    color: "#8D96A5",
    fontSize: 14,
    fontWeight: "700",
  },
  jerseyBadge: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#332711",
    color: "#F9C846",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    paddingTop: 3,
  },
  profileChip: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#151F28",
    color: "#AEB8C7",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  completeChip: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#113B2B",
    color: "#72E6A4",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  missingChip: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#332711",
    color: "#F9C846",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  ratingButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#35C77B",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ratingButtonDisabled: {
    backgroundColor: "#1C2530",
  },
  ratingButtonText: {
    color: "#06110C",
    fontSize: 13,
    fontWeight: "900",
  },
  ratingButtonTextDisabled: {
    color: "#8D96A5",
  },
  lockedHelp: {
    color: "#8D96A5",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  ratingCard: {
    gap: 16,
    borderWidth: 1,
    borderColor: "#1F513A",
    borderRadius: 28,
    backgroundColor: "#0F251C",
    padding: 20,
  },
  ratingHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  ratingHeaderText: {
    flex: 1,
    gap: 5,
  },
  ratingTitle: {
    color: "#F4F7F2",
    fontSize: 22,
    fontWeight: "900",
  },
  ratingSubtitle: {
    color: "#72E6A4",
    fontSize: 14,
    fontWeight: "800",
  },
  ratingHelp: {
    color: "#AEB8C7",
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#182820",
  },
  closeButtonText: {
    color: "#F4F7F2",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 26,
  },
  ratingAttribute: {
    gap: 8,
  },
  ratingAttributeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ratingAttributeLabel: {
    color: "#F4F7F2",
    fontSize: 15,
    fontWeight: "900",
  },
  ratingAttributeValue: {
    color: "#F9C846",
    fontSize: 14,
    fontWeight: "900",
  },
  levelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  levelButton: {
    minWidth: 50,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#25313D",
    borderRadius: 16,
    backgroundColor: "#141A22",
    paddingVertical: 10,
  },
  levelButtonSelected: {
    borderColor: "#F9C846",
    backgroundColor: "#332711",
  },
  levelButtonText: {
    color: "#8D96A5",
    fontSize: 13,
    fontWeight: "900",
  },
  levelButtonTextSelected: {
    color: "#F9C846",
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#F9C846",
    paddingVertical: 15,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#141006",
    fontSize: 16,
    fontWeight: "900",
  },
});

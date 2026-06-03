import { useAuth } from "@clerk/expo";
import type { FootballGroup, PlayerProfile } from "@fit-five/shared";
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

import { listCurrentUserGroups, listGroupPlayers } from "@/api/client";
import { usePreferences } from "@/features/preferences/preferences-context";

type RosterLoadState = "loading" | "ready" | "noGroup" | "error";

export default function JoueursScreen() {
  const { getToken } = useAuth();
  const { strings } = usePreferences();
  const [activeGroup, setActiveGroup] = useState<FootballGroup | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [loadState, setLoadState] = useState<RosterLoadState>("loading");

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
        setLoadState("noGroup");
        return;
      }

      const rosterResponse = await listGroupPlayers(token, firstGroup.id);
      setActiveGroup(firstGroup);
      setPlayers(rosterResponse.data.players);
      setLoadState("ready");
    } catch (error) {
      console.warn("Unable to load player roster", error);
      setLoadState("error");
    }
  }

  useEffect(() => {
    void loadRoster();
  }, [getToken]);

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
            {players.map((player) => (
              <PlayerRosterCard key={player.id} player={player} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type PlayerRosterCardProps = {
  player: PlayerProfile;
};

function PlayerRosterCard({ player }: PlayerRosterCardProps) {
  const { strings } = usePreferences();
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
      </View>
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
    gap: 7,
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
});

import type { FootballMatch } from "@fit-five/shared";
import { StyleSheet, Text, View } from "react-native";

import { usePreferences } from "@/features/preferences/preferences-context";

type NextMatchCardProps = {
  match: FootballMatch;
};

export function NextMatchCard({ match }: NextMatchCardProps) {
  const { strings } = usePreferences();
  const startsAt = new Date(match.startsAt);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>{strings.matches.nextTitle}</Text>
          <Text style={styles.title}>{match.title}</Text>
        </View>
        <Text style={styles.format}>
          {match.playersPerTeam}v{match.playersPerTeam}
        </Text>
      </View>

      <View style={styles.detailList}>
        <Text style={styles.detailText}>{formatDateTime(startsAt)}</Text>
        <Text style={styles.detailText}>{match.location}</Text>
        <Text style={styles.detailText}>
          {match.confirmedCount}/{match.maxPlayers}{" "}
          {strings.matches.confirmedCount} · {match.waitlistCount}{" "}
          {strings.matches.waitlistCount}
        </Text>
      </View>

      <Text style={styles.helperText}>
        {strings.matches.attendancePlaceholder}
      </Text>
    </View>
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#1F513A",
    borderRadius: 26,
    backgroundColor: "#0C2118",
    padding: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  kicker: {
    color: "#72E6A4",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#F4F7F2",
    fontSize: 21,
    fontWeight: "900",
  },
  format: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#332711",
    color: "#F9C846",
    fontSize: 13,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailList: {
    gap: 5,
  },
  detailText: {
    color: "#AEB8C7",
    fontSize: 14,
    fontWeight: "800",
  },
  helperText: {
    color: "#8D96A5",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
});

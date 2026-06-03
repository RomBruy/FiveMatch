import type {
  FootballMatch,
  FootballMatchAttendanceResponse,
} from "@fit-five/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { usePreferences } from "@/features/preferences/preferences-context";

type NextMatchCardProps = {
  match: FootballMatch;
  onRespond?: (response: FootballMatchAttendanceResponse) => void;
  responseState?: "idle" | "submitting" | "error";
};

export function NextMatchCard({
  match,
  onRespond,
  responseState = "idle",
}: NextMatchCardProps) {
  const { strings } = usePreferences();
  const startsAt = new Date(match.startsAt);
  const activeResponse = match.myAttendance?.response ?? null;

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

      {onRespond ? (
        <View style={styles.attendanceSection}>
          <View style={styles.responseRow}>
            {(["in", "maybe", "out"] as const).map((response) => (
              <Pressable
                key={response}
                disabled={responseState === "submitting"}
                onPress={() => onRespond(response)}
                style={[
                  styles.responseButton,
                  activeResponse === response && styles.responseButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.responseButtonText,
                    activeResponse === response &&
                      styles.responseButtonTextActive,
                  ]}
                >
                  {getResponseLabel(response, strings)}
                </Text>
              </Pressable>
            ))}
          </View>

          {match.myAttendance ? (
            <Text style={styles.activeStateText}>
              {getAttendanceStateLabel(match, strings)}
            </Text>
          ) : (
            <Text style={styles.helperText}>
              {strings.matches.attendancePlaceholder}
            </Text>
          )}

          {responseState === "submitting" ? (
            <Text style={styles.helperText}>
              {strings.matches.attendanceSubmitting}
            </Text>
          ) : null}
          {responseState === "error" ? (
            <Text style={styles.errorText}>
              {strings.matches.attendanceError}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.helperText}>
          {strings.matches.attendancePlaceholder}
        </Text>
      )}
    </View>
  );
}

function getResponseLabel(
  response: FootballMatchAttendanceResponse,
  strings: ReturnType<typeof usePreferences>["strings"]
) {
  if (response === "in") {
    return strings.matches.attendanceIn;
  }

  if (response === "out") {
    return strings.matches.attendanceOut;
  }

  return strings.matches.attendanceMaybe;
}

function getAttendanceStateLabel(
  match: FootballMatch,
  strings: ReturnType<typeof usePreferences>["strings"]
) {
  if (match.myAttendance?.status === "confirmed") {
    return strings.matches.attendanceConfirmed;
  }

  if (match.myAttendance?.status === "waitlisted") {
    const position = match.myAttendance.waitlistPosition;

    if (position) {
      return `${strings.matches.attendanceWaitlisted} · ${strings.matches.attendanceWaitlistPosition} #${position}`;
    }

    return strings.matches.attendanceWaitlisted;
  }

  if (match.myAttendance?.status === "out") {
    return strings.matches.attendanceOutState;
  }

  return strings.matches.attendanceMaybeState;
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
  attendanceSection: {
    gap: 9,
  },
  responseRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  responseButton: {
    flexGrow: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#25313D",
    borderRadius: 16,
    backgroundColor: "#141A22",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  responseButtonActive: {
    borderColor: "#F9C846",
    backgroundColor: "#332711",
  },
  responseButtonText: {
    color: "#AEB8C7",
    fontSize: 13,
    fontWeight: "900",
  },
  responseButtonTextActive: {
    color: "#F9C846",
  },
  activeStateText: {
    color: "#72E6A4",
    fontSize: 13,
    fontWeight: "900",
  },
  errorText: {
    color: "#FF6464",
    fontSize: 13,
    fontWeight: "900",
  },
});

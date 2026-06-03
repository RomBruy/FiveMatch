import { useAuth } from "@clerk/expo";
import {
  playerVestiaireFields,
  type FootballGroup,
  type PlayerProfile,
  type PlayerVestiaireField,
} from "@fit-five/shared";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getMyPlayerProfile,
  listCurrentUserGroups,
  upsertMyPlayerVestiaire,
} from "@/api/client";
import { usePreferences } from "@/features/preferences/preferences-context";

type LoadState = "loading" | "ready" | "noGroup" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";

const badFaithLevels = [0, 25, 50, 75, 100] as const;

export default function VestiaireScreen() {
  const { getToken } = useAuth();
  const { strings } = usePreferences();
  const [activeGroup, setActiveGroup] = useState<FootballGroup | null>(null);
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [specialty, setSpecialty] = useState("");
  const [favoriteExcuse, setFavoriteExcuse] = useState("");
  const [badFaithLevel, setBadFaithLevel] = useState<number | null>(null);
  const [lockerRoomStyle, setLockerRoomStyle] = useState("");
  const [thirdHalfProfile, setThirdHalfProfile] = useState("");
  const [warCry, setWarCry] = useState("");
  const [signatureCelebration, setSignatureCelebration] = useState("");
  const [worstOnPitchHabit, setWorstOnPitchHabit] = useState("");
  const [legendaryPhrase, setLegendaryPhrase] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadVestiaire() {
      setLoadState("loading");

      try {
        const token = await getToken();

        if (!token) {
          throw new Error("Missing auth token.");
        }

        const groupsResponse = await listCurrentUserGroups(token);
        const firstGroup = groupsResponse.data.groups[0];

        if (!firstGroup) {
          if (isActive) {
            setActiveGroup(null);
            setPlayer(null);
            setLoadState("noGroup");
          }

          return;
        }

        const profileResponse = await getMyPlayerProfile(token, firstGroup.id);

        if (isActive) {
          setActiveGroup(firstGroup);
          setPlayer(profileResponse.data.player);
          applyVestiaireToForm(profileResponse.data.player, {
            setSpecialty,
            setFavoriteExcuse,
            setBadFaithLevel,
            setLockerRoomStyle,
            setThirdHalfProfile,
            setWarCry,
            setSignatureCelebration,
            setWorstOnPitchHabit,
            setLegendaryPhrase,
          });
          setLoadState("ready");
        }
      } catch (error) {
        console.warn("Unable to load vestiaire profile", error);

        if (isActive) {
          setLoadState("error");
        }
      }
    }

    void loadVestiaire();

    return () => {
      isActive = false;
    };
  }, [getToken]);

  async function handleSaveVestiaire() {
    if (!activeGroup) {
      return;
    }

    setSaveState("saving");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await upsertMyPlayerVestiaire(token, activeGroup.id, {
        specialty: normalizeTextValue(specialty),
        favoriteExcuse: normalizeTextValue(favoriteExcuse),
        badFaithLevel,
        lockerRoomStyle: normalizeTextValue(lockerRoomStyle),
        thirdHalfProfile: normalizeTextValue(thirdHalfProfile),
        warCry: normalizeTextValue(warCry),
        signatureCelebration: normalizeTextValue(signatureCelebration),
        worstOnPitchHabit: normalizeTextValue(worstOnPitchHabit),
        legendaryPhrase: normalizeTextValue(legendaryPhrase),
      });

      setPlayer(response.data.player);
      applyVestiaireToForm(response.data.player, {
        setSpecialty,
        setFavoriteExcuse,
        setBadFaithLevel,
        setLockerRoomStyle,
        setThirdHalfProfile,
        setWarCry,
        setSignatureCelebration,
        setWorstOnPitchHabit,
        setLegendaryPhrase,
      });
      setSaveState("saved");
    } catch (error) {
      console.warn("Unable to save vestiaire profile", error);
      setSaveState("error");
    }
  }

  const missingFields =
    player?.vestiaireMissingFields ??
    (loadState === "ready" ? [...playerVestiaireFields] : []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>{strings.navigation.lockerRoom}</Text>
          <Text style={styles.title}>{strings.vestiaire.title}</Text>
          <Text style={styles.subtitle}>{strings.vestiaire.subtitle}</Text>
        </View>

        {activeGroup ? (
          <View style={styles.groupCard}>
            <Text style={styles.groupLabel}>
              {strings.vestiaire.groupLabel}
            </Text>
            <Text style={styles.groupName}>{activeGroup.name}</Text>
          </View>
        ) : null}

        {loadState === "loading" ? (
          <Text style={styles.statusText}>{strings.vestiaire.loading}</Text>
        ) : null}

        {loadState === "noGroup" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{strings.vestiaire.title}</Text>
            <Text style={styles.subtitle}>{strings.vestiaire.noGroup}</Text>
          </View>
        ) : null}

        {loadState === "error" ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{strings.vestiaire.error}</Text>
          </View>
        ) : null}

        {loadState === "ready" ? (
          <>
            <VestiaireProgress fields={missingFields} />

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>
                {strings.vestiaire.balanceNoteTitle}
              </Text>
              <Text style={styles.noteText}>
                {strings.vestiaire.balanceNote}
              </Text>
            </View>

            <View style={styles.card}>
              <VestiaireTextField
                label={strings.vestiaire.fields.specialty}
                placeholder={strings.vestiaire.placeholders.specialty}
                value={specialty}
                onChangeText={setSpecialty}
              />
              <SuggestionChips
                suggestions={strings.vestiaire.suggestions.specialty}
                onSelect={setSpecialty}
              />

              <VestiaireTextField
                label={strings.vestiaire.fields.favoriteExcuse}
                placeholder={strings.vestiaire.placeholders.favoriteExcuse}
                value={favoriteExcuse}
                onChangeText={setFavoriteExcuse}
              />
              <SuggestionChips
                suggestions={strings.vestiaire.suggestions.favoriteExcuse}
                onSelect={setFavoriteExcuse}
              />

              <BadFaithSelector
                value={badFaithLevel}
                onChange={setBadFaithLevel}
              />

              <VestiaireTextField
                label={strings.vestiaire.fields.lockerRoomStyle}
                placeholder={strings.vestiaire.placeholders.lockerRoomStyle}
                value={lockerRoomStyle}
                onChangeText={setLockerRoomStyle}
              />
              <SuggestionChips
                suggestions={strings.vestiaire.suggestions.lockerRoomStyle}
                onSelect={setLockerRoomStyle}
              />

              <VestiaireTextField
                label={strings.vestiaire.fields.thirdHalfProfile}
                placeholder={strings.vestiaire.placeholders.thirdHalfProfile}
                value={thirdHalfProfile}
                onChangeText={setThirdHalfProfile}
              />
              <SuggestionChips
                suggestions={strings.vestiaire.suggestions.thirdHalfProfile}
                onSelect={setThirdHalfProfile}
              />

              <VestiaireTextField
                label={strings.vestiaire.fields.warCry}
                placeholder={strings.vestiaire.placeholders.warCry}
                value={warCry}
                onChangeText={setWarCry}
              />
              <SuggestionChips
                suggestions={strings.vestiaire.suggestions.warCry}
                onSelect={setWarCry}
              />

              <VestiaireTextField
                label={strings.vestiaire.fields.signatureCelebration}
                placeholder={
                  strings.vestiaire.placeholders.signatureCelebration
                }
                value={signatureCelebration}
                onChangeText={setSignatureCelebration}
              />
              <SuggestionChips
                suggestions={strings.vestiaire.suggestions.signatureCelebration}
                onSelect={setSignatureCelebration}
              />

              <VestiaireTextField
                label={strings.vestiaire.fields.worstOnPitchHabit}
                placeholder={strings.vestiaire.placeholders.worstOnPitchHabit}
                value={worstOnPitchHabit}
                onChangeText={setWorstOnPitchHabit}
              />
              <SuggestionChips
                suggestions={strings.vestiaire.suggestions.worstOnPitchHabit}
                onSelect={setWorstOnPitchHabit}
              />

              <VestiaireTextField
                label={strings.vestiaire.fields.legendaryPhrase}
                placeholder={strings.vestiaire.placeholders.legendaryPhrase}
                value={legendaryPhrase}
                onChangeText={setLegendaryPhrase}
                multiline
              />
              <SuggestionChips
                suggestions={strings.vestiaire.suggestions.legendaryPhrase}
                onSelect={setLegendaryPhrase}
              />

              <Pressable
                disabled={saveState === "saving"}
                onPress={() => void handleSaveVestiaire()}
                style={[
                  styles.primaryButton,
                  saveState === "saving" && styles.primaryButtonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {saveState === "saving"
                    ? strings.vestiaire.saving
                    : strings.vestiaire.saveButton}
                </Text>
              </Pressable>

              {saveState === "saved" ? (
                <Text style={styles.successText}>
                  {strings.vestiaire.saved}
                </Text>
              ) : null}
              {saveState === "error" ? (
                <Text style={styles.errorText}>{strings.vestiaire.error}</Text>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type VestiaireTextFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
};

function VestiaireTextField({
  label,
  placeholder,
  value,
  onChangeText,
  multiline = false,
}: VestiaireTextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize="sentences"
        autoCorrect={false}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6B7482"
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
      />
    </View>
  );
}

type SuggestionChipsProps = {
  suggestions: readonly string[];
  onSelect: (value: string) => void;
};

function SuggestionChips({ suggestions, onSelect }: SuggestionChipsProps) {
  return (
    <View style={styles.suggestionRow}>
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion}
          onPress={() => onSelect(suggestion)}
          style={styles.suggestionChip}
        >
          <Text style={styles.suggestionChipText}>{suggestion}</Text>
        </Pressable>
      ))}
    </View>
  );
}

type BadFaithSelectorProps = {
  value: number | null;
  onChange: (value: number | null) => void;
};

function BadFaithSelector({ value, onChange }: BadFaithSelectorProps) {
  const { strings } = usePreferences();

  return (
    <View style={styles.field}>
      <View style={styles.badFaithHeader}>
        <Text style={styles.fieldLabel}>
          {strings.vestiaire.fields.badFaithLevel}
        </Text>
        <Text style={styles.badFaithValue}>
          {value === null ? "--" : `${value}%`}
        </Text>
      </View>
      <Text style={styles.helperText}>{strings.vestiaire.badFaithHelper}</Text>
      <View style={styles.levelRow}>
        {badFaithLevels.map((level) => {
          const isSelected = value === level;

          return (
            <Pressable
              key={level}
              onPress={() => onChange(isSelected ? null : level)}
              style={[styles.levelButton, isSelected && styles.levelSelected]}
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
  );
}

type VestiaireProgressProps = {
  fields: PlayerVestiaireField[];
};

function VestiaireProgress({ fields }: VestiaireProgressProps) {
  const { strings } = usePreferences();
  const completedCount = playerVestiaireFields.length - fields.length;
  const completionPercentage = Math.round(
    (completedCount / playerVestiaireFields.length) * 100
  );

  return (
    <View style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <View>
          <Text style={styles.cardTitle}>
            {fields.length === 0
              ? strings.vestiaire.completionCompleteTitle
              : strings.vestiaire.completionTitle}
          </Text>
          <Text style={styles.subtitle}>
            {strings.vestiaire.completionSubtitle}
          </Text>
        </View>
        <Text style={styles.progressPercent}>{completionPercentage}%</Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${completionPercentage}%`,
            },
          ]}
        />
      </View>

      {fields.length > 0 ? (
        <View style={styles.missingChips}>
          {fields.map((field) => (
            <Text key={field} style={styles.missingChip}>
              {strings.vestiaire.fields[field]}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

type ApplyVestiaireToFormOptions = {
  setSpecialty: (value: string) => void;
  setFavoriteExcuse: (value: string) => void;
  setBadFaithLevel: (value: number | null) => void;
  setLockerRoomStyle: (value: string) => void;
  setThirdHalfProfile: (value: string) => void;
  setWarCry: (value: string) => void;
  setSignatureCelebration: (value: string) => void;
  setWorstOnPitchHabit: (value: string) => void;
  setLegendaryPhrase: (value: string) => void;
};

function applyVestiaireToForm(
  player: PlayerProfile | null,
  options: ApplyVestiaireToFormOptions
) {
  options.setSpecialty(player?.specialty ?? "");
  options.setFavoriteExcuse(player?.favoriteExcuse ?? "");
  options.setBadFaithLevel(player?.badFaithLevel ?? null);
  options.setLockerRoomStyle(player?.lockerRoomStyle ?? "");
  options.setThirdHalfProfile(player?.thirdHalfProfile ?? "");
  options.setWarCry(player?.warCry ?? "");
  options.setSignatureCelebration(player?.signatureCelebration ?? "");
  options.setWorstOnPitchHabit(player?.worstOnPitchHabit ?? "");
  options.setLegendaryPhrase(player?.legendaryPhrase ?? "");
}

function normalizeTextValue(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
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
    color: "#F9C846",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  title: {
    color: "#F4F7F2",
    fontSize: 31,
    fontWeight: "900",
  },
  subtitle: {
    color: "#8D96A5",
    fontSize: 15,
    lineHeight: 21,
  },
  groupCard: {
    gap: 5,
    borderWidth: 1,
    borderColor: "#1F513A",
    borderRadius: 24,
    backgroundColor: "#0F251C",
    padding: 18,
  },
  groupLabel: {
    color: "#72E6A4",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  groupName: {
    color: "#F4F7F2",
    fontSize: 20,
    fontWeight: "900",
  },
  card: {
    gap: 14,
    borderWidth: 1,
    borderColor: "#1D2A25",
    borderRadius: 28,
    backgroundColor: "#10161D",
    padding: 20,
  },
  noteCard: {
    gap: 6,
    borderWidth: 1,
    borderColor: "#4C3E18",
    borderRadius: 22,
    backgroundColor: "#211C12",
    padding: 16,
  },
  noteTitle: {
    color: "#F9C846",
    fontSize: 15,
    fontWeight: "900",
  },
  noteText: {
    color: "#C6B57B",
    fontSize: 14,
    lineHeight: 20,
  },
  cardTitle: {
    color: "#F4F7F2",
    fontSize: 21,
    fontWeight: "900",
  },
  progressCard: {
    gap: 14,
    borderWidth: 1,
    borderColor: "#1D2A25",
    borderRadius: 28,
    backgroundColor: "#10161D",
    padding: 20,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  progressPercent: {
    color: "#72E6A4",
    fontSize: 27,
    fontWeight: "900",
  },
  progressTrack: {
    height: 10,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#1E2630",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#35C77B",
  },
  missingChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  missingChip: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#332711",
    color: "#F9C846",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: "#F4F7F2",
    fontSize: 15,
    fontWeight: "900",
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#25313D",
    borderRadius: 18,
    backgroundColor: "#141A22",
    color: "#F4F7F2",
    fontSize: 16,
    paddingHorizontal: 16,
  },
  multilineInput: {
    minHeight: 90,
    paddingTop: 14,
    textAlignVertical: "top",
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 3,
  },
  suggestionChip: {
    borderRadius: 999,
    backgroundColor: "#151F28",
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  suggestionChipText: {
    color: "#8D96A5",
    fontSize: 12,
    fontWeight: "800",
  },
  badFaithHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badFaithValue: {
    color: "#F9C846",
    fontSize: 18,
    fontWeight: "900",
  },
  helperText: {
    color: "#8D96A5",
    fontSize: 13,
    fontWeight: "700",
  },
  levelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  levelButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 53,
    borderWidth: 1,
    borderColor: "#25313D",
    borderRadius: 16,
    backgroundColor: "#141A22",
    paddingVertical: 11,
  },
  levelSelected: {
    borderColor: "#F9C846",
    backgroundColor: "#332711",
  },
  levelButtonText: {
    color: "#8D96A5",
    fontSize: 14,
    fontWeight: "900",
  },
  levelButtonTextSelected: {
    color: "#F9C846",
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#F9C846",
    paddingVertical: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#141006",
    fontSize: 16,
    fontWeight: "900",
  },
  statusText: {
    color: "#8D96A5",
    fontSize: 15,
    fontWeight: "800",
  },
  successText: {
    color: "#72E6A4",
    fontSize: 14,
    fontWeight: "900",
  },
  errorText: {
    color: "#FF6464",
    fontSize: 14,
    fontWeight: "900",
  },
});

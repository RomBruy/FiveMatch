import { useAuth, useUser } from "@clerk/expo";
import {
  playerDominantFeet,
  playerPreferredStyles,
  playerProfileFields,
  supportedLocales,
  type FootballGroup,
  type PlayerDominantFoot,
  type PlayerPreferredStyle,
  type PlayerProfile,
  type PlayerProfileField,
  type SupportedLocale,
} from "@fit-five/shared";
import { useRouter } from "expo-router";
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
  updateCurrentUserPreferences,
  upsertMyPlayerProfile,
} from "@/api/client";
import { usePreferences } from "@/features/preferences/preferences-context";

type LoadState = "loading" | "ready" | "noGroup" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";

export default function ProfileScreen() {
  const router = useRouter();
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
  const { locale, setLocale, strings } = usePreferences();
  const [languageSaveState, setLanguageSaveState] = useState<SaveState>("idle");
  const displayName =
    user?.fullName ??
    user?.primaryEmailAddress?.emailAddress ??
    strings.profile.fallbackName;

  async function handleLanguageChange(nextLocale: SupportedLocale) {
    setLanguageSaveState("saving");

    try {
      await setLocale(nextLocale);
      const token = await getToken();

      if (token) {
        await updateCurrentUserPreferences(token, {
          preferredLocale: nextLocale,
        });
      }

      setLanguageSaveState("saved");
    } catch (error) {
      console.warn("Unable to update preferred language", error);
      setLanguageSaveState("error");
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/sign-in");
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>{strings.profile.kicker}</Text>
          <Text style={styles.title}>{displayName}</Text>
          <Text style={styles.subtitle}>{strings.profile.sessionSubtitle}</Text>
        </View>

        <PlayerProfileCard
          accountFirstName={user?.firstName ?? null}
          accountLastName={user?.lastName ?? null}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{strings.profile.languageTitle}</Text>
          <Text style={styles.subtitle}>
            {strings.profile.languageSubtitle}
          </Text>

          <View style={styles.optionGrid}>
            {supportedLocales.map((supportedLocale) => (
              <Pressable
                key={supportedLocale}
                onPress={() => void handleLanguageChange(supportedLocale)}
                style={[
                  styles.optionButton,
                  locale === supportedLocale && styles.optionButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    locale === supportedLocale &&
                      styles.optionButtonTextSelected,
                  ]}
                >
                  {supportedLocale === "fr"
                    ? strings.profile.french
                    : strings.profile.english}
                </Text>
              </Pressable>
            ))}
          </View>

          {languageSaveState === "saving" ? (
            <Text style={styles.statusText}>{strings.profile.saving}</Text>
          ) : null}
          {languageSaveState === "saved" ? (
            <Text style={styles.successText}>{strings.profile.saved}</Text>
          ) : null}
          {languageSaveState === "error" ? (
            <Text style={styles.errorText}>{strings.profile.saveError}</Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => void handleSignOut()}
          style={styles.dangerButton}
        >
          <Text style={styles.dangerButtonText}>{strings.profile.signOut}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

type PlayerProfileCardProps = {
  accountFirstName: string | null;
  accountLastName: string | null;
};

function PlayerProfileCard({
  accountFirstName,
  accountLastName,
}: PlayerProfileCardProps) {
  const { getToken } = useAuth();
  const { strings } = usePreferences();
  const [activeGroup, setActiveGroup] = useState<FootballGroup | null>(null);
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [firstName, setFirstName] = useState(accountFirstName ?? "");
  const [lastName, setLastName] = useState(accountLastName ?? "");
  const [nickname, setNickname] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [bio, setBio] = useState("");
  const [dominantFoot, setDominantFoot] = useState<PlayerDominantFoot | null>(
    null
  );
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [preferredStyle, setPreferredStyle] =
    useState<PlayerPreferredStyle | null>(null);
  const [clubDeFormation, setClubDeFormation] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
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
          applyPlayerToForm(profileResponse.data.player, {
            accountFirstName,
            accountLastName,
            setFirstName,
            setLastName,
            setNickname,
            setPhotoUrl,
            setBio,
            setDominantFoot,
            setJerseyNumber,
            setPreferredStyle,
            setClubDeFormation,
          });
          setLoadState("ready");
        }
      } catch (error) {
        console.warn("Unable to load player profile", error);

        if (isActive) {
          setLoadState("error");
        }
      }
    }

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [accountFirstName, accountLastName, getToken]);

  function handleJerseyNumberChange(nextValue: string) {
    setJerseyNumber(nextValue.replace(/\D/g, "").slice(0, 2));
  }

  async function handleSaveProfile() {
    if (!activeGroup) {
      return;
    }

    setSaveState("saving");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await upsertMyPlayerProfile(token, activeGroup.id, {
        firstName: normalizeTextValue(firstName),
        lastName: normalizeTextValue(lastName),
        nickname: normalizeTextValue(nickname),
        photoUrl: normalizeTextValue(photoUrl),
        bio: normalizeTextValue(bio),
        dominantFoot,
        jerseyNumber: parseJerseyNumber(jerseyNumber),
        preferredStyle,
        clubDeFormation: normalizeTextValue(clubDeFormation),
      });

      setPlayer(response.data.player);
      applyPlayerToForm(response.data.player, {
        accountFirstName,
        accountLastName,
        setFirstName,
        setLastName,
        setNickname,
        setPhotoUrl,
        setBio,
        setDominantFoot,
        setJerseyNumber,
        setPreferredStyle,
        setClubDeFormation,
      });
      setSaveState("saved");
    } catch (error) {
      console.warn("Unable to save player profile", error);
      setSaveState("error");
    }
  }

  const missingFields =
    player?.missingFields ??
    (loadState === "ready" ? [...playerProfileFields] : []);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{strings.players.profileTitle}</Text>
      <Text style={styles.subtitle}>{strings.players.profileSubtitle}</Text>

      {activeGroup ? (
        <Text style={styles.groupBadge}>{activeGroup.name}</Text>
      ) : null}

      {loadState === "loading" ? (
        <Text style={styles.statusText}>{strings.auth.loadingSession}</Text>
      ) : null}

      {loadState === "noGroup" ? (
        <Text style={styles.emptyText}>{strings.players.noGroup}</Text>
      ) : null}

      {loadState === "error" ? (
        <Text style={styles.errorText}>{strings.players.profileError}</Text>
      ) : null}

      {loadState === "ready" ? (
        <>
          <MissingProfileFields fields={missingFields} />

          <View style={styles.formSection}>
            <View style={styles.twoColumn}>
              <ProfileTextField
                label={strings.players.firstName}
                value={firstName}
                onChangeText={setFirstName}
              />
              <ProfileTextField
                label={strings.players.lastName}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>

            <ProfileTextField
              label={strings.players.nickname}
              value={nickname}
              onChangeText={setNickname}
            />
            <ProfileTextField
              label={strings.players.photoUrl}
              placeholder={strings.players.photoPlaceholder}
              value={photoUrl}
              onChangeText={setPhotoUrl}
              keyboardType="url"
            />
            <ProfileTextField
              label={strings.players.bio}
              placeholder={strings.players.bioPlaceholder}
              value={bio}
              onChangeText={setBio}
              multiline
            />

            <ProfileOptionSelector
              label={strings.players.dominantFoot}
              labels={strings.players.dominantFootOptions}
              options={playerDominantFeet}
              value={dominantFoot}
              onSelect={setDominantFoot}
            />

            <ProfileTextField
              label={strings.players.jerseyNumber}
              value={jerseyNumber}
              onChangeText={handleJerseyNumberChange}
              keyboardType="number-pad"
            />

            <ProfileOptionSelector
              label={strings.players.preferredStyle}
              labels={strings.players.preferredStyleOptions}
              options={playerPreferredStyles}
              value={preferredStyle}
              onSelect={setPreferredStyle}
            />

            <ProfileTextField
              label={strings.players.clubDeFormation}
              placeholder={strings.players.clubPlaceholder}
              value={clubDeFormation}
              onChangeText={setClubDeFormation}
            />
          </View>

          <Pressable
            onPress={() => void handleSaveProfile()}
            style={[
              styles.primaryButton,
              saveState === "saving" && styles.primaryButtonDisabled,
            ]}
            disabled={saveState === "saving"}
          >
            <Text style={styles.primaryButtonText}>
              {saveState === "saving"
                ? strings.players.savingProfile
                : strings.players.saveProfileButton}
            </Text>
          </Pressable>

          {saveState === "saved" ? (
            <Text style={styles.successText}>
              {strings.players.profileSaved}
            </Text>
          ) : null}
          {saveState === "error" ? (
            <Text style={styles.errorText}>{strings.players.profileError}</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

type ProfileTextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad" | "url";
  multiline?: boolean;
};

function ProfileTextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
}: ProfileTextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize="sentences"
        autoCorrect={false}
        keyboardType={keyboardType}
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

type ProfileOptionSelectorProps<TOption extends string> = {
  label: string;
  labels: Record<TOption, string>;
  options: readonly TOption[];
  value: TOption | null;
  onSelect: (value: TOption | null) => void;
};

function ProfileOptionSelector<TOption extends string>({
  label,
  labels,
  options,
  value,
  onSelect,
}: ProfileOptionSelectorProps<TOption>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.optionGrid}>
        {options.map((option) => {
          const isSelected = option === value;

          return (
            <Pressable
              key={option}
              onPress={() => onSelect(isSelected ? null : option)}
              style={[
                styles.optionButton,
                isSelected && styles.optionButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  isSelected && styles.optionButtonTextSelected,
                ]}
              >
                {labels[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type MissingProfileFieldsProps = {
  fields: PlayerProfileField[];
};

function MissingProfileFields({ fields }: MissingProfileFieldsProps) {
  const { strings } = usePreferences();

  if (fields.length === 0) {
    return (
      <View style={styles.completeBox}>
        <Text style={styles.completeTitle}>
          {strings.players.completeTitle}
        </Text>
        <Text style={styles.completeSubtitle}>
          {strings.players.completeSubtitle}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.missingBox}>
      <Text style={styles.missingTitle}>{strings.players.missingTitle}</Text>
      <View style={styles.missingChips}>
        {fields.map((field) => (
          <Text key={field} style={styles.missingChip}>
            {strings.players.missingFields[field]}
          </Text>
        ))}
      </View>
    </View>
  );
}

type ApplyPlayerToFormOptions = {
  accountFirstName: string | null;
  accountLastName: string | null;
  setFirstName: (value: string) => void;
  setLastName: (value: string) => void;
  setNickname: (value: string) => void;
  setPhotoUrl: (value: string) => void;
  setBio: (value: string) => void;
  setDominantFoot: (value: PlayerDominantFoot | null) => void;
  setJerseyNumber: (value: string) => void;
  setPreferredStyle: (value: PlayerPreferredStyle | null) => void;
  setClubDeFormation: (value: string) => void;
};

function applyPlayerToForm(
  player: PlayerProfile | null,
  options: ApplyPlayerToFormOptions
) {
  options.setFirstName(player?.firstName ?? options.accountFirstName ?? "");
  options.setLastName(player?.lastName ?? options.accountLastName ?? "");
  options.setNickname(player?.nickname ?? "");
  options.setPhotoUrl(player?.photoUrl ?? "");
  options.setBio(player?.bio ?? "");
  options.setDominantFoot(player?.dominantFoot ?? null);
  options.setJerseyNumber(
    player?.jerseyNumber !== null && player?.jerseyNumber !== undefined
      ? String(player.jerseyNumber)
      : ""
  );
  options.setPreferredStyle(player?.preferredStyle ?? null);
  options.setClubDeFormation(player?.clubDeFormation ?? "");
}

function normalizeTextValue(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseJerseyNumber(value: string) {
  if (value.trim().length === 0) {
    return null;
  }

  return Number.parseInt(value, 10);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07110D",
  },
  content: {
    padding: 20,
    paddingBottom: 44,
    gap: 20,
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
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#8D96A5",
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    gap: 14,
    borderWidth: 1,
    borderColor: "#1D2A25",
    borderRadius: 28,
    backgroundColor: "#10161D",
    padding: 20,
  },
  cardTitle: {
    color: "#F4F7F2",
    fontSize: 22,
    fontWeight: "800",
  },
  groupBadge: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#113B2B",
    color: "#72E6A4",
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  formSection: {
    gap: 14,
  },
  twoColumn: {
    flexDirection: "row",
    gap: 12,
  },
  field: {
    flex: 1,
    gap: 8,
  },
  fieldLabel: {
    color: "#F4F7F2",
    fontSize: 14,
    fontWeight: "800",
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
    minHeight: 92,
    paddingTop: 14,
    textAlignVertical: "top",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: "#25313D",
    borderRadius: 999,
    backgroundColor: "#141A22",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionButtonSelected: {
    borderColor: "#35C77B",
    backgroundColor: "#123A2B",
  },
  optionButtonText: {
    color: "#8D96A5",
    fontSize: 14,
    fontWeight: "800",
  },
  optionButtonTextSelected: {
    color: "#72E6A4",
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#35C77B",
    paddingVertical: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#06110C",
    fontSize: 16,
    fontWeight: "900",
  },
  dangerButton: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#57242B",
    borderRadius: 20,
    backgroundColor: "#2A1014",
    paddingVertical: 16,
  },
  dangerButtonText: {
    color: "#FF6464",
    fontSize: 16,
    fontWeight: "900",
  },
  statusText: {
    color: "#8D96A5",
    fontSize: 14,
    fontWeight: "700",
  },
  successText: {
    color: "#72E6A4",
    fontSize: 14,
    fontWeight: "800",
  },
  errorText: {
    color: "#FF6464",
    fontSize: 14,
    fontWeight: "800",
  },
  emptyText: {
    color: "#F4F7F2",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
  completeBox: {
    gap: 4,
    borderWidth: 1,
    borderColor: "#1F513A",
    borderRadius: 18,
    backgroundColor: "#0F251C",
    padding: 14,
  },
  completeTitle: {
    color: "#72E6A4",
    fontSize: 15,
    fontWeight: "900",
  },
  completeSubtitle: {
    color: "#8D96A5",
    fontSize: 13,
    lineHeight: 19,
  },
  missingBox: {
    gap: 10,
    borderWidth: 1,
    borderColor: "#4C3E18",
    borderRadius: 18,
    backgroundColor: "#211C12",
    padding: 14,
  },
  missingTitle: {
    color: "#F9C846",
    fontSize: 15,
    fontWeight: "900",
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
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});

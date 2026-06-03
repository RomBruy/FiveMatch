import {
  groupGeneratorStyles,
  groupGoalkeeperModes,
  groupIntensities,
  groupPlayStyles,
  supportedLocales,
  type FootballGroup,
  type FootballGroupInvitation,
  type FootballGroupMember,
  type GroupGeneratorStyle,
  type GroupGoalkeeperMode,
  type GroupIntensity,
  type GroupPlayStyle,
  type SupportedLocale,
} from "@fit-five/shared";
import { useAuth } from "@clerk/expo";
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
  acceptFootballGroupInvitation,
  createFootballGroup,
  createFootballGroupInvitation,
  listFootballGroupMembers,
  listCurrentUserGroups,
  removeFootballGroupMember,
  updateFootballGroupMemberRole,
  updateFootballGroupSettings,
} from "@/api/client";
import { usePreferences } from "@/features/preferences/preferences-context";

export default function HomeScreen() {
  const { getToken } = useAuth();
  const { locale, strings } = usePreferences();
  const [groups, setGroups] = useState<FootballGroup[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [createState, setCreateState] = useState<"idle" | "creating" | "error">(
    "idle"
  );
  const [inviteState, setInviteState] = useState<
    "idle" | "creating" | "created" | "sharing" | "error"
  >("idle");
  const [joinState, setJoinState] = useState<
    "idle" | "accepting" | "accepted" | "error"
  >("idle");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [invitation, setInvitation] = useState<FootballGroupInvitation | null>(
    null
  );
  const [showPlayerProfilePrompt, setShowPlayerProfilePrompt] = useState(false);
  const [defaultLanguage, setDefaultLanguage] =
    useState<SupportedLocale>(locale);
  const [playStyle, setPlayStyle] = useState<GroupPlayStyle>("flexible");
  const [intensity, setIntensity] = useState<GroupIntensity>("balanced");
  const [goalkeeperMode, setGoalkeeperMode] = useState<GroupGoalkeeperMode>(
    "rotating_goalkeeper"
  );
  const [generatorStyle, setGeneratorStyle] =
    useState<GroupGeneratorStyle>("fair_fresh");

  async function loadGroups() {
    setLoadState("loading");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await listCurrentUserGroups(token);
      setGroups(response.data.groups);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }

  useEffect(() => {
    void loadGroups();
  }, [getToken]);

  async function handleCreateGroup() {
    const trimmedName = name.trim();

    if (trimmedName.length < 2) {
      return;
    }

    setCreateState("creating");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await createFootballGroup(token, {
        name: trimmedName,
        defaultLanguage,
        playStyle,
        intensity,
        goalkeeperMode,
        generatorStyle,
      });

      setGroups((currentGroups) => [...currentGroups, response.data.group]);
      setName("");
      setCreateState("idle");
      setLoadState("ready");
    } catch (error) {
      console.warn("Unable to create group", error);
      setCreateState("error");
    }
  }

  async function handleCreateInvitation(groupId: string) {
    setInviteState("creating");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await createFootballGroupInvitation(token, groupId);
      setInvitation(response.data.invitation);
      setInviteState("created");
    } catch (error) {
      console.warn("Unable to create invitation", error);
      setInviteState("error");
    }
  }

  async function handleShareInvitation() {
    if (!invitation) {
      return;
    }

    setInviteState("sharing");

    try {
      await Share.share({
        message: `${strings.groups.shareInviteMessage} ${invitation.inviteUrl}`,
      });
      setInviteState("created");
    } catch (error) {
      console.warn("Unable to share invitation", error);
      setInviteState("error");
    }
  }

  async function handleAcceptInvite() {
    const inviteToken = extractInviteToken(joinCode);

    if (!inviteToken) {
      return;
    }

    setJoinState("accepting");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await acceptFootballGroupInvitation(token, inviteToken);
      const joinedGroup = response.data.group;

      setGroups((currentGroups) => {
        if (currentGroups.some((group) => group.id === joinedGroup.id)) {
          return currentGroups.map((group) =>
            group.id === joinedGroup.id ? joinedGroup : group
          );
        }

        return [...currentGroups, joinedGroup];
      });
      setJoinCode("");
      setJoinState("accepted");
      setLoadState("ready");
      setShowPlayerProfilePrompt(
        response.data.nextAction === "create_player_profile"
      );
    } catch (error) {
      console.warn("Unable to accept invitation", error);
      setJoinState("error");
    }
  }

  function handleGroupUpdated(updatedGroup: FootballGroup) {
    setGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.id === updatedGroup.id ? updatedGroup : group
      )
    );
  }

  const activeGroup = groups[0];
  const canCreate = name.trim().length >= 2 && createState !== "creating";
  const canAccept =
    extractInviteToken(joinCode).length > 0 && joinState !== "accepting";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>FiveMatch</Text>
          <Text style={styles.title}>{strings.home.title}</Text>
          <Text style={styles.subtitle}>{strings.home.subtitle}</Text>
        </View>

        {activeGroup ? (
          <>
            <GroupSummaryCard
              group={activeGroup}
              invitation={invitation}
              inviteState={inviteState}
              onCreateInvitation={handleCreateInvitation}
              onShareInvitation={handleShareInvitation}
              showPlayerProfilePrompt={showPlayerProfilePrompt}
            />
            <GroupSettingsManagementCard
              group={activeGroup}
              onGroupUpdated={handleGroupUpdated}
            />
            <GroupMembersManagementCard group={activeGroup} />
          </>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{strings.groups.joinTitle}</Text>
              <Text style={styles.subtitle}>{strings.groups.joinSubtitle}</Text>

              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>
                  {strings.groups.joinCodeLabel}
                </Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setJoinCode}
                  placeholder={strings.groups.joinCodePlaceholder}
                  placeholderTextColor="#6B7482"
                  style={styles.input}
                  value={joinCode}
                />
              </View>

              {joinState === "error" ? (
                <Text style={styles.errorText}>
                  {strings.groups.acceptInviteError}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={!canAccept}
                onPress={() => {
                  void handleAcceptInvite();
                }}
                style={[styles.button, !canAccept && styles.buttonDisabled]}
              >
                <Text style={styles.buttonText}>
                  {joinState === "accepting"
                    ? strings.groups.acceptingInvite
                    : strings.groups.acceptInviteButton}
                </Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{strings.groups.emptyTitle}</Text>
              <Text style={styles.subtitle}>
                {strings.groups.emptySubtitle}
              </Text>

              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>
                  {strings.groups.nameLabel}
                </Text>
                <TextInput
                  autoCapitalize="words"
                  onChangeText={setName}
                  placeholder={strings.groups.namePlaceholder}
                  placeholderTextColor="#6B7482"
                  style={styles.input}
                  value={name}
                />
              </View>

              <OptionSelector
                label={strings.groups.defaultLanguage}
                labels={strings.groups.options.defaultLanguage}
                onSelect={setDefaultLanguage}
                options={supportedLocales}
                value={defaultLanguage}
              />
              <OptionSelector
                label={strings.groups.playStyle}
                labels={strings.groups.options.playStyle}
                onSelect={setPlayStyle}
                options={groupPlayStyles}
                value={playStyle}
              />
              <OptionSelector
                label={strings.groups.intensity}
                labels={strings.groups.options.intensity}
                onSelect={setIntensity}
                options={groupIntensities}
                value={intensity}
              />
              <OptionSelector
                label={strings.groups.goalkeeperMode}
                labels={strings.groups.options.goalkeeperMode}
                onSelect={setGoalkeeperMode}
                options={groupGoalkeeperModes}
                value={goalkeeperMode}
              />
              <OptionSelector
                label={strings.groups.generatorStyle}
                labels={strings.groups.options.generatorStyle}
                onSelect={setGeneratorStyle}
                options={groupGeneratorStyles}
                value={generatorStyle}
              />

              {createState === "error" || loadState === "error" ? (
                <Text style={styles.errorText}>
                  {strings.groups.createError}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={!canCreate}
                onPress={() => {
                  void handleCreateGroup();
                }}
                style={[styles.button, !canCreate && styles.buttonDisabled]}
              >
                <Text style={styles.buttonText}>
                  {createState === "creating"
                    ? strings.groups.creating
                    : strings.groups.createButton}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function GroupSummaryCard({
  group,
  invitation,
  inviteState,
  onCreateInvitation,
  onShareInvitation,
  showPlayerProfilePrompt,
}: {
  group: FootballGroup;
  invitation: FootballGroupInvitation | null;
  inviteState: "idle" | "creating" | "created" | "sharing" | "error";
  onCreateInvitation: (groupId: string) => void;
  onShareInvitation: () => void;
  showPlayerProfilePrompt: boolean;
}) {
  const { strings } = usePreferences();
  const canManageInvites =
    group.currentUserRole === "owner" || group.currentUserRole === "admin";

  return (
    <View style={styles.groupStack}>
      <View style={styles.groupHero}>
        <Text style={styles.kicker}>{strings.groups.createdKicker}</Text>
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.ownerBadge}>{strings.groups.ownerBadge}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{strings.groups.nextActionTitle}</Text>
        <Text style={styles.subtitle}>
          {showPlayerProfilePrompt
            ? strings.groups.acceptedInviteDescription
            : strings.groups.nextActionDescription}
        </Text>
      </View>

      {showPlayerProfilePrompt ? (
        <View style={styles.promptCard}>
          <Text style={styles.cardTitle}>
            {strings.groups.playerProfilePromptTitle}
          </Text>
          <Text style={styles.subtitle}>
            {strings.groups.playerProfilePromptDescription}
          </Text>
        </View>
      ) : null}

      {canManageInvites ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{strings.groups.inviteTitle}</Text>
          <Text style={styles.subtitle}>{strings.groups.inviteSubtitle}</Text>

          {invitation ? (
            <View style={styles.inviteBox}>
              <Text style={styles.cardLabel}>
                {strings.groups.inviteCodeLabel}
              </Text>
              <Text style={styles.inviteValue}>{invitation.token}</Text>
              <Text style={styles.cardLabel}>
                {strings.groups.inviteLinkLabel}
              </Text>
              <Text style={styles.inviteValue}>{invitation.inviteUrl}</Text>
            </View>
          ) : null}

          {inviteState === "error" ? (
            <Text style={styles.errorText}>{strings.groups.inviteError}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={inviteState === "creating"}
            onPress={() => {
              onCreateInvitation(group.id);
            }}
            style={[
              styles.button,
              inviteState === "creating" && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.buttonText}>
              {inviteState === "creating"
                ? strings.groups.creatingInvite
                : strings.groups.createInviteButton}
            </Text>
          </Pressable>

          {invitation ? (
            <Pressable
              accessibilityRole="button"
              disabled={inviteState === "sharing"}
              onPress={onShareInvitation}
              style={[
                styles.secondaryButton,
                inviteState === "sharing" && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {strings.groups.shareInviteButton}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>{strings.groups.settingsTitle}</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>
            {strings.groups.defaultLanguage}
          </Text>
          <Text style={styles.settingValue}>
            {
              strings.groups.options.defaultLanguage[
                group.settings.defaultLanguage
              ]
            }
          </Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>{strings.groups.playStyle}</Text>
          <Text style={styles.settingValue}>
            {strings.groups.options.playStyle[group.settings.playStyle]}
          </Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>{strings.groups.intensity}</Text>
          <Text style={styles.settingValue}>
            {strings.groups.options.intensity[group.settings.intensity]}
          </Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>
            {strings.groups.goalkeeperMode}
          </Text>
          <Text style={styles.settingValue}>
            {
              strings.groups.options.goalkeeperMode[
                group.settings.goalkeeperMode
              ]
            }
          </Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>
            {strings.groups.generatorStyle}
          </Text>
          <Text style={styles.settingValue}>
            {
              strings.groups.options.generatorStyle[
                group.settings.generatorStyle
              ]
            }
          </Text>
        </View>
      </View>
    </View>
  );
}

function GroupSettingsManagementCard({
  group,
  onGroupUpdated,
}: {
  group: FootballGroup;
  onGroupUpdated: (group: FootballGroup) => void;
}) {
  const { getToken } = useAuth();
  const { strings } = usePreferences();
  const canUpdateSettings =
    group.currentUserRole === "owner" || group.currentUserRole === "admin";
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [draftPlayStyle, setDraftPlayStyle] = useState<GroupPlayStyle>(
    group.settings.playStyle
  );
  const [draftIntensity, setDraftIntensity] = useState<GroupIntensity>(
    group.settings.intensity
  );
  const [draftGoalkeeperMode, setDraftGoalkeeperMode] =
    useState<GroupGoalkeeperMode>(group.settings.goalkeeperMode);
  const [draftGeneratorStyle, setDraftGeneratorStyle] =
    useState<GroupGeneratorStyle>(group.settings.generatorStyle);

  useEffect(() => {
    setDraftPlayStyle(group.settings.playStyle);
    setDraftIntensity(group.settings.intensity);
    setDraftGoalkeeperMode(group.settings.goalkeeperMode);
    setDraftGeneratorStyle(group.settings.generatorStyle);
  }, [
    group.settings.generatorStyle,
    group.settings.goalkeeperMode,
    group.settings.intensity,
    group.settings.playStyle,
  ]);

  if (!canUpdateSettings) {
    return null;
  }

  async function handleSaveSettings() {
    setSaveState("saving");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await updateFootballGroupSettings(token, group.id, {
        playStyle: draftPlayStyle,
        intensity: draftIntensity,
        goalkeeperMode: draftGoalkeeperMode,
        generatorStyle: draftGeneratorStyle,
      });

      onGroupUpdated(response.data.group);
      setSaveState("saved");
    } catch (error) {
      console.warn("Unable to update group settings", error);
      setSaveState("error");
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{strings.groups.manageSettingsTitle}</Text>
      <Text style={styles.subtitle}>
        {strings.groups.manageSettingsSubtitle}
      </Text>

      <OptionSelector
        label={strings.groups.playStyle}
        labels={strings.groups.options.playStyle}
        onSelect={setDraftPlayStyle}
        options={groupPlayStyles}
        value={draftPlayStyle}
      />
      <OptionSelector
        label={strings.groups.intensity}
        labels={strings.groups.options.intensity}
        onSelect={setDraftIntensity}
        options={groupIntensities}
        value={draftIntensity}
      />
      <OptionSelector
        label={strings.groups.goalkeeperMode}
        labels={strings.groups.options.goalkeeperMode}
        onSelect={setDraftGoalkeeperMode}
        options={groupGoalkeeperModes}
        value={draftGoalkeeperMode}
      />
      <OptionSelector
        label={strings.groups.generatorStyle}
        labels={strings.groups.options.generatorStyle}
        onSelect={setDraftGeneratorStyle}
        options={groupGeneratorStyles}
        value={draftGeneratorStyle}
      />

      {saveState === "saved" ? (
        <Text style={styles.successText}>{strings.groups.settingsSaved}</Text>
      ) : null}
      {saveState === "error" ? (
        <Text style={styles.errorText}>{strings.groups.settingsError}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={saveState === "saving"}
        onPress={() => {
          void handleSaveSettings();
        }}
        style={[styles.button, saveState === "saving" && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>
          {saveState === "saving"
            ? strings.groups.savingSettings
            : strings.groups.saveSettingsButton}
        </Text>
      </Pressable>
    </View>
  );
}

function GroupMembersManagementCard({ group }: { group: FootballGroup }) {
  const { getToken } = useAuth();
  const { strings } = usePreferences();
  const [members, setMembers] = useState<FootballGroupMember[]>([]);
  const [memberState, setMemberState] = useState<
    "idle" | "loading" | "saved" | "removed" | "error"
  >("idle");

  if (group.currentUserRole !== "owner") {
    return null;
  }

  async function handleLoadMembers() {
    setMemberState("loading");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await listFootballGroupMembers(token, group.id);
      setMembers(response.data.members);
      setMemberState("idle");
    } catch (error) {
      console.warn("Unable to load group members", error);
      setMemberState("error");
    }
  }

  async function handleUpdateRole(member: FootballGroupMember) {
    const nextRole = member.role === "admin" ? "member" : "admin";
    setMemberState("loading");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await updateFootballGroupMemberRole(
        token,
        group.id,
        member.id,
        {
          role: nextRole,
        }
      );

      setMembers((currentMembers) =>
        currentMembers.map((currentMember) =>
          currentMember.id === response.data.member.id
            ? response.data.member
            : currentMember
        )
      );
      setMemberState("saved");
    } catch (error) {
      console.warn("Unable to update member role", error);
      setMemberState("error");
    }
  }

  async function handleRemoveMember(member: FootballGroupMember) {
    setMemberState("loading");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Missing auth token.");
      }

      const response = await removeFootballGroupMember(
        token,
        group.id,
        member.id
      );
      setMembers((currentMembers) =>
        currentMembers.filter(
          (currentMember) => currentMember.id !== response.data.removedMemberId
        )
      );
      setMemberState("removed");
    } catch (error) {
      console.warn("Unable to remove member", error);
      setMemberState("error");
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{strings.groups.manageMembersTitle}</Text>
      <Text style={styles.subtitle}>
        {strings.groups.manageMembersSubtitle}
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={memberState === "loading"}
        onPress={() => {
          void handleLoadMembers();
        }}
        style={[
          styles.secondaryButton,
          memberState === "loading" && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.secondaryButtonText}>
          {strings.groups.loadMembersButton}
        </Text>
      </Pressable>

      {memberState === "saved" ? (
        <Text style={styles.successText}>{strings.groups.roleUpdated}</Text>
      ) : null}
      {memberState === "removed" ? (
        <Text style={styles.successText}>{strings.groups.memberRemoved}</Text>
      ) : null}
      {memberState === "error" ? (
        <Text style={styles.errorText}>{strings.groups.membersError}</Text>
      ) : null}

      {members.map((member) => {
        const canEditMember = member.role !== "owner";
        const displayName =
          [member.user.firstName, member.user.lastName]
            .filter(Boolean)
            .join(" ") ||
          member.user.emailAddress ||
          member.user.id;

        return (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.memberHeader}>
              <Text style={styles.memberName}>{displayName}</Text>
              <Text style={styles.roleBadge}>
                {strings.groups.roles[member.role]}
              </Text>
            </View>

            {canEditMember ? (
              <View style={styles.memberActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void handleUpdateRole(member);
                  }}
                  style={styles.optionButton}
                >
                  <Text style={styles.optionText}>
                    {member.role === "admin"
                      ? strings.groups.demoteMember
                      : strings.groups.promoteAdmin}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void handleRemoveMember(member);
                  }}
                  style={styles.dangerButton}
                >
                  <Text style={styles.dangerButtonText}>
                    {strings.groups.removeMember}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function extractInviteToken(value: string): string {
  const parts = value.trim().split("/").filter(Boolean);

  return parts[parts.length - 1]?.trim() ?? "";
}

function OptionSelector<TValue extends string>({
  label,
  labels,
  onSelect,
  options,
  value,
}: {
  label: string;
  labels: Record<TValue, string>;
  onSelect: (value: TValue) => void;
  options: readonly TValue[];
  value: TValue;
}) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.optionGrid}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option}
            onPress={() => {
              onSelect(option);
            }}
            style={[
              styles.optionButton,
              option === value && styles.optionButtonActive,
            ]}
          >
            <Text
              style={[
                styles.optionText,
                option === value && styles.optionTextActive,
              ]}
            >
              {labels[option]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07110D",
  },
  content: {
    gap: 24,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    gap: 12,
    paddingTop: 24,
  },
  kicker: {
    color: "#35C77B",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    color: "#F4F7F2",
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 42,
  },
  subtitle: {
    color: "#98A4B3",
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    backgroundColor: "#121922",
    borderColor: "#1D2630",
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    padding: 24,
  },
  cardLabel: {
    color: "#7D8796",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: "#F4F7F2",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
  },
  promptCard: {
    backgroundColor: "#162315",
    borderColor: "#3CA55C",
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 24,
  },
  formSection: {
    gap: 10,
  },
  fieldLabel: {
    color: "#DCE4EA",
    fontSize: 15,
    fontWeight: "900",
  },
  input: {
    backgroundColor: "#0D141D",
    borderColor: "#27313F",
    borderRadius: 18,
    borderWidth: 1,
    color: "#F4F7F2",
    fontSize: 17,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionButton: {
    backgroundColor: "#0D141D",
    borderColor: "#27313F",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  optionButtonActive: {
    backgroundColor: "#123322",
    borderColor: "#35C77B",
  },
  optionText: {
    color: "#98A4B3",
    fontSize: 14,
    fontWeight: "900",
  },
  optionTextActive: {
    color: "#35C77B",
  },
  button: {
    alignItems: "center",
    backgroundColor: "#35C77B",
    borderRadius: 18,
    padding: 16,
  },
  buttonText: {
    color: "#07110D",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#0D141D",
    borderColor: "#35C77B",
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  secondaryButtonText: {
    color: "#35C77B",
    fontSize: 16,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontWeight: "800",
  },
  successText: {
    color: "#35C77B",
    fontSize: 14,
    fontWeight: "800",
  },
  groupStack: {
    gap: 18,
  },
  groupHero: {
    backgroundColor: "#10241A",
    borderColor: "#1C6B44",
    borderRadius: 32,
    borderWidth: 1,
    gap: 12,
    padding: 24,
  },
  groupName: {
    color: "#F4F7F2",
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 40,
  },
  ownerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#173B28",
    borderColor: "#35C77B",
    borderRadius: 999,
    borderWidth: 1,
    color: "#35C77B",
    fontSize: 13,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 6,
    textTransform: "uppercase",
  },
  inviteBox: {
    backgroundColor: "#0D141D",
    borderColor: "#27313F",
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  inviteValue: {
    color: "#F4F7F2",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 22,
  },
  memberCard: {
    backgroundColor: "#0D141D",
    borderColor: "#27313F",
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  memberHeader: {
    alignItems: "flex-start",
    gap: 8,
  },
  memberName: {
    color: "#F4F7F2",
    fontSize: 16,
    fontWeight: "900",
  },
  roleBadge: {
    backgroundColor: "#173B28",
    borderColor: "#35C77B",
    borderRadius: 999,
    borderWidth: 1,
    color: "#35C77B",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  memberActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  dangerButton: {
    backgroundColor: "#2A1115",
    borderColor: "#D84444",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dangerButtonText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontWeight: "900",
  },
  settingRow: {
    borderTopColor: "#1D2630",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
    paddingTop: 14,
  },
  settingLabel: {
    color: "#98A4B3",
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  settingValue: {
    color: "#F4F7F2",
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },
});

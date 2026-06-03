import { PlaceholderScreen } from '@/components/placeholder-screen';
import { usePreferences } from '@/features/preferences/preferences-context';

export default function MatchScreen() {
  const { strings } = usePreferences();

  return (
    <PlaceholderScreen
      title={strings.navigation.match}
      subtitle={strings.placeholders.match}
    />
  );
}

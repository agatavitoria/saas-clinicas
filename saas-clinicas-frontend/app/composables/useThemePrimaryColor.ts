import { useTheme } from 'vuetify'

/**
 * Aplica a cor de uma clínica como cor principal do tema enquanto o
 * componente estiver montado. Roda já no setup (inclusive no SSR), antes da
 * primeira renderização; ao sair, volta a cor padrão.
 */
export function useThemePrimaryColor(color: MaybeRefOrGetter<string>): void {
  const theme = useTheme()
  const apply = (value: string) => {
    theme.themes.value.light!.colors.primary = value
  }

  apply(toValue(color))
  watch(() => toValue(color), apply)
  onBeforeUnmount(() => apply(DEFAULT_PRIMARY_COLOR))
}

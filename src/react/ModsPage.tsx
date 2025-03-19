import { useEffect, useState } from 'react'
import { useSnapshot } from 'valtio'
import { addRepositoryAction, setEnabledModAction, getAllModsDisplayList, installModByName, selectAndRemoveRepository, uninstallModAction, fetchAllRepositories, modsReactiveUpdater, modsErrors } from '../clientMods'
import { createNotificationProgressReporter, ProgressReporter } from '../core/progressReporter'
import { useIsModalActive } from './utilsApp'
import Input from './Input'
import Button from './Button'
import styles from './mods.module.css'
import { showOptionsModal } from './SelectOption'
import Screen from './Screen'
import { pixelartIcons } from './PixelartIcon'
import { showNotification } from './NotificationProvider'
import { usePassesScaledDimensions } from './UIProvider'

type ModsData = Awaited<ReturnType<typeof getAllModsDisplayList>>

const ModSidebar = ({ mod }: { mod: (ModsData['repos'][0]['packages'][0] & { repo?: string }) | null }) => {
  // just make it update
  const { counter } = useSnapshot(modsReactiveUpdater)
  const errors = useSnapshot(modsErrors)

  const handleAction = async (action: () => Promise<void>, errorMessage: string, progress?: ProgressReporter) => {
    try {
      await action()
      progress?.end()
    } catch (error) {
      console.error(error)
      progress?.end()
      showNotification(errorMessage, error.message, true)
    }
  }

  if (!mod) {
    return <div className={styles.modInfoText}>Select a mod to view details</div>
  }

  return (
    <>
      <div className={styles.modInfo}>
        <div className={styles.modInfoTitle}>{mod.name}</div>
        <div className={styles.modInfoText}>
          {mod.description}
        </div>
        <div className={styles.modInfoText}>
          {mod.author && `Author: ${mod.author}`}
          {mod.version && `\nVersion: ${mod.version}`}
          {mod.section && `\nSection: ${mod.section}`}
        </div>
        {errors[mod.name]?.length > 0 && (
          <div className={styles.modErrorList}>
            <ul>
              {errors[mod.name].map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className={styles.modActions}>
        {mod.installed ? (
          <>
            {mod.enabled ? (
              <Button
                onClick={async () => handleAction(
                  async () => setEnabledModAction(mod.name, false),
                  'Failed to disable mod:'
                )}
                icon={pixelartIcons['remove-box']}
                title="Disable"
              />
            ) : (
              <Button
                onClick={async () => handleAction(
                  async () => setEnabledModAction(mod.name, true),
                  'Failed to enable mod:'
                )}
                icon={pixelartIcons['add-box']}
                title="Enable"
              />
            )}
            <Button
              onClick={async () => handleAction(
                async () => uninstallModAction(mod.name),
                'Failed to uninstall mod:'
              )}
              icon={pixelartIcons.trash}
              title="Delete"
            />
          </>
        ) : (
          <Button
            onClick={async () => {
              if (!mod.repo) return
              const progress = createNotificationProgressReporter(`${mod.name} installed and enabled`)
              await handleAction(
                async () => {
                  await installModByName(mod.repo!, mod.name, progress)
                },
                'Failed to install & activate mod:',
                progress
              )
            }}
            icon={pixelartIcons.download}
            title="Install"
          />
        )}
      </div>
    </>
  )
}

export default () => {
  const isModalActive = useIsModalActive('mods', true)
  const [modsData, setModsData] = useState<ModsData | null>(null)
  const [search, setSearch] = useState('')
  const [showOnlyInstalled, setShowOnlyInstalled] = useState(false)
  const [showOnlyEnabled, setShowOnlyEnabled] = useState(false)
  const [selectedMod, setSelectedMod] = useState<(ModsData['repos'][0]['packages'][0] & { repo?: string }) | null>(null)
  const [expandedRepos, setExpandedRepos] = useState<Record<string, boolean>>({})
  const useHorizontalLayout = usePassesScaledDimensions(400)
  const { counter } = useSnapshot(modsReactiveUpdater)
  const errors = useSnapshot(modsErrors)

  useEffect(() => {
    if (isModalActive) {
      void getAllModsDisplayList().then(mods => {
        setModsData(mods)
        if (selectedMod) {
          setSelectedMod(mods.repos.find(repo => repo.packages.find(mod => mod.name === selectedMod.name))?.packages.find(mod => mod.name === selectedMod.name) ?? null)
        }
      })
    }
  }, [isModalActive, counter])

  if (!isModalActive) return null

  const toggleRepo = (repoUrl: string) => {
    setExpandedRepos(prev => ({
      ...prev,
      [repoUrl]: !prev[repoUrl]
    }))
  }

  const modFilter = (mod: ModsData['repos'][0]['packages'][0]) => {
    const matchesSearch = mod.name.toLowerCase().includes(search.toLowerCase()) ||
      mod.description?.toLowerCase().includes(search.toLowerCase())
    const matchesInstalledFilter = !showOnlyInstalled || mod.installed
    const matchesEnabledFilter = !showOnlyEnabled || mod.enabled
    return matchesSearch && matchesInstalledFilter && matchesEnabledFilter
  }

  const filteredMods = modsData ? {
    repos: modsData.repos.map(repo => ({
      ...repo,
      packages: repo.packages.filter(modFilter)
    })),
    modsWithoutRepos: modsData.modsWithoutRepos.filter(modFilter)
  } : null

  const getStatsText = () => {
    if (!modsData) return 'Loading...'
    const totalRepos = modsData.repos.length
    const totalMods = modsData.repos.reduce((acc, repo) => acc + repo.packages.length, 0) + modsData.modsWithoutRepos.length
    const filteredModsCount = filteredMods ?
      filteredMods.repos.reduce((acc, repo) => acc + repo.packages.length, 0) + filteredMods.modsWithoutRepos.length : 0

    if (showOnlyEnabled) {
      return `Showing enabled mods (${filteredModsCount} of ${totalMods})`
    }
    if (showOnlyInstalled) {
      return `Showing installed mods (${filteredModsCount} of ${totalMods})`
    }
    return `Showing all ${totalRepos} repos with ${filteredModsCount} mods`
  }

  return <Screen backdrop="dirt" title="Client Mods" titleMarginTop={0} contentStyle={{ paddingTop: 15, height: '100%', width: '100%' }}>
    <div className={styles.root}>
      <div className={styles.header}>
        <Button
          style={{}}
          icon={pixelartIcons['sliders']}
          onClick={() => {
            if (showOnlyEnabled) {
              setShowOnlyEnabled(false)
            } else if (showOnlyInstalled) {
              setShowOnlyInstalled(false)
              setShowOnlyEnabled(true)
            } else {
              setShowOnlyInstalled(true)
            }
          }}
          title={showOnlyEnabled ? 'Show all mods' : showOnlyInstalled ? 'Show enabled mods' : 'Show installed mods'}
        />
        <Button
          onClick={async () => {
            const refreshButton = `Refresh repositories (last update)`
            const choice = await showOptionsModal(`Manage repositories (${modsData?.repos.length ?? '-'} repos)`, ['Add repository', 'Remove repository', refreshButton])
            switch (choice) {
              case 'Add repository': {
                await addRepositoryAction()
                break
              }
              case 'Remove repository': {
                await selectAndRemoveRepository()
                break
              }
              case refreshButton: {
                await fetchAllRepositories()
                break
              }
              case undefined:
                break
            }
          }}
          icon={pixelartIcons['list-box']}
          title="Manage repositories"
        />
        <Input
          className={styles.searchBar}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search mods..."
        />
      </div>
      <div className={styles.statsRow}>
        {getStatsText()}
      </div>
      <div className={`${styles.content} ${useHorizontalLayout ? '' : styles.verticalContent}`}>
        <div className={styles.modList}>
          {filteredMods ? (
            <>
              {filteredMods.repos.map(repo => (
                <div key={repo.url}>
                  <div
                    className={styles.repoHeader}
                    onClick={() => toggleRepo(repo.url)}
                  >
                    <span>{expandedRepos[repo.url] ? '▼' : '▶'}</span>
                    <span>{repo.name || repo.url}</span>
                    <span>({repo.packages.length})</span>
                  </div>
                  {expandedRepos[repo.url] && (
                    <div className={styles.repoContent}>
                      {repo.packages.map(mod => (
                        <div
                          key={mod.name}
                          className={styles.modRow}
                          onClick={() => setSelectedMod({ ...mod, repo: repo.url })}
                          data-enabled={mod.enabled}
                          data-has-error={errors[mod.name]?.length > 0}
                        >
                          <div className={styles.modRowTitle}>{mod.name}</div>
                          <div className={styles.modRowInfo}>
                            {mod.description}
                            {mod.author && ` • By ${mod.author}`}
                            {mod.version && ` • v${mod.version}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {filteredMods.modsWithoutRepos.length > 0 && (
                <div>
                  <div className={styles.repoHeader}>
                    <span>▼</span>
                    <span>Other Mods</span>
                    <span>({filteredMods.modsWithoutRepos.length})</span>
                  </div>
                  <div className={styles.repoContent}>
                    {filteredMods.modsWithoutRepos.map(mod => (
                      <div
                        key={mod.name}
                        className={styles.modRow}
                        onClick={() => setSelectedMod(mod)}
                        data-enabled={mod.enabled}
                        data-has-error={errors[mod.name]?.length > 0}
                      >
                        <div className={styles.modRowTitle}>{mod.name}</div>
                        <div className={styles.modRowInfo}>
                          {mod.description}
                          {mod.author && ` • By ${mod.author}`}
                          {mod.version && ` • v${mod.version}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={styles.modRowInfo}>Loading mods...</div>
          )}
        </div>
        <div className={styles.sidebar}>
          <ModSidebar mod={selectedMod} />
        </div>
      </div>
    </div>
  </Screen>
}

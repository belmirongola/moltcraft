import { useEffect, useState } from 'react'
import { getAllModsDisplayList } from '../clientMods'
import { useIsModalActive } from './utilsApp'
import Input from './Input'
import Button from './Button'
import styles from './mods.module.css'

type ModsData = Awaited<ReturnType<typeof getAllModsDisplayList>>

export default () => {
  const isModalActive = useIsModalActive('mods')
  const [modsData, setModsData] = useState<ModsData | null>(null)
  const [search, setSearch] = useState('')
  const [showOnlyInstalled, setShowOnlyInstalled] = useState(false)
  const [selectedMod, setSelectedMod] = useState<ModsData['repos'][0]['packages'][0] | null>(null)
  const [expandedRepos, setExpandedRepos] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (isModalActive) {
      void getAllModsDisplayList().then(setModsData)
    }
  }, [isModalActive])

  if (!isModalActive) return null

  const toggleRepo = (repoUrl: string) => {
    setExpandedRepos(prev => ({
      ...prev,
      [repoUrl]: !prev[repoUrl]
    }))
  }

  const filteredMods = modsData ? {
    repos: modsData.repos.map(repo => ({
      ...repo,
      packages: repo.packages.filter(mod => {
        const matchesSearch = mod.name.toLowerCase().includes(search.toLowerCase()) ||
          mod.description?.toLowerCase().includes(search.toLowerCase())
        const matchesFilter = !showOnlyInstalled || mod.installed
        return matchesSearch && matchesFilter
      })
    })),
    modsWithoutRepos: modsData.modsWithoutRepos.filter(mod => {
      const matchesSearch = mod.name.toLowerCase().includes(search.toLowerCase()) ||
        mod.description?.toLowerCase().includes(search.toLowerCase())
      const matchesFilter = !showOnlyInstalled || mod.installed
      return matchesSearch && matchesFilter
    })
  } : null

  return <div>
    <div className="dirt-bg" />
    <div className="fullscreen">
      <div className="screen-title">Client Mods</div>
      <div className={styles.root}>
        <div className={styles.header}>
          <Input
            className={styles.searchBar}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search mods..."
          />
          <Button
            className={styles.filterButton}
            onClick={() => setShowOnlyInstalled(!showOnlyInstalled)}
          >
            {showOnlyInstalled ? 'Show All' : 'Show Installed'}
          </Button>
          <Button onClick={() => {}}>Manage Repos</Button>
        </div>
        <div className={styles.content}>
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
                            onClick={() => setSelectedMod(mod)}
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
            {selectedMod ? (
              <>
                <div className={styles.modInfo}>
                  <div className={styles.modInfoTitle}>{selectedMod.name}</div>
                  <div className={styles.modInfoText}>
                    {selectedMod.description}
                  </div>
                  <div className={styles.modInfoText}>
                    {selectedMod.author && `Author: ${selectedMod.author}`}
                    {selectedMod.version && `\nVersion: ${selectedMod.version}`}
                    {selectedMod.section && `\nSection: ${selectedMod.section}`}
                  </div>
                </div>
                <div className={styles.modActions}>
                  <Button onClick={() => {}}>
                    {selectedMod.installed ? 'Uninstall' : 'Install'}
                  </Button>
                  {selectedMod.installed && (
                    <>
                      <Button onClick={() => {}}>Update</Button>
                      <Button onClick={() => {}}>Delete</Button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.modInfoText}>Select a mod to view details</div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
}

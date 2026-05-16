'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import styles from './HUD.module.css';
import HackTerminalModal from './HackTerminalModal';

import { useGameStore } from '../store/gameStore';
import { useGameActions } from '../hooks/useContractWrite';
import { usePlayerInitialized } from '../hooks/useContractRead';
import { COST_MINER, COST_FIREWALL, COST_DATACENTER } from '../config/contracts';

const leaderboard = [
  { rank: 1, player: 'P1', page: 3, bonus: '+5% Data' },
  { rank: 2, player: 'P2', page: 3, bonus: '+5% Data' },
  { rank: 3, player: 'P1', page: 5, bonus: '+3% Data' },
];

export default function HUD() {
  const [mounted, setMounted] = useState(false);
  const { globalResources, selectedNodeId, mapData, collectData, buildNode, destroyNode, dataLogs, currentPlayer } = useGameStore();
  const { address } = useAccount();

  // On-chain yazma aksiyonları
  const {
    initPlayer,
    hackNode,
    buildOnNode,
    extractResources,
    upgradeNode,
    destroyFirewall,
    isPending: isTxPending,
    isConfirming: isTxConfirming,
    isSuccess: isTxSuccess,
    writeError,
    reset: resetTx,
  } = useGameActions();

  // Oyuncu başlatılmış mı?
  const { isInitialized } = usePlayerInitialized();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Bağlı cüzdanın kısaltılmış adresi (sahiplik karşılaştırması için)
  const myAddress = currentPlayer?.toLowerCase() ?? null;

  const resources = [
    { label: 'DATA',     value: globalResources, color: '#4ade80' },
    { label: 'SECURITY', value: 315,   color: '#38bdf8' },
    { label: 'CREDITS',  value: 89,    color: '#fbbf24' },
  ];

  const selectedNode = selectedNodeId !== null ? mapData.find(n => n.id === selectedNodeId) : null;

  // ── DataCenter metadata ────────────────────────────────────────────────
  const recentLogs = dataLogs.slice(0, 3);

  // ── Mainframe metadata ─────────────────────────────────────────────────
  const subnetId = selectedNode ? Math.floor(selectedNode.id / 128) : 0;
  const firewallCount = selectedNode
    ? mapData.filter(n => {
        const nodeSubnet = Math.floor(n.id / 128);
        return nodeSubnet === subnetId && n.buildingType === 2;
      }).length
    : 0;
  // Her Firewall = %10 güvenlik, maksimum %100
  const securityPct = Math.min(firewallCount * 10, 100);

  // ── Hack Terminal state ──────────────────────────────────────────────────
  const [isHackOpen, setIsHackOpen] = useState(false);

  // Düşman bina mı? (owner var ama bana ait değil) ve Miner/Firewall/DataCenter mı?
  const isMyNode =
    selectedNode !== null &&
    selectedNode !== undefined &&
    selectedNode.owner !== null &&
    myAddress !== null &&
    selectedNode.owner.toLowerCase() === myAddress;

  const isEnemyBuilding =
    selectedNode !== null &&
    selectedNode !== undefined &&
    selectedNode.owner !== null &&
    !isMyNode &&
    (selectedNode.buildingType === 1 || selectedNode.buildingType === 2 || selectedNode.buildingType === 3);

  // Hedef subnet'teki Firewall sayısına göre zorluk
  const hackDifficulty: 'easy' | 'medium' | 'hard' =
    firewallCount >= 7 ? 'hard' : firewallCount >= 3 ? 'medium' : 'easy';

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
  };

  if (!mounted) return null; // Next.js SSR hydration sorununu önlemek için

  return (
    <div className={styles.hud}>

      {/* ── Top-left: Leaderboard ── */}
      <div className={`${styles.panel} ${styles.leaderboard}`}>
        <div className={styles.panelTitle}>LEADERBOARD</div>
        {leaderboard.map(({ rank, player, page, bonus }) => (
          <div key={rank} className={styles.lbRow}>
            <span className={styles.lbRank}>{rank}.</span>
            <span className={styles.lbPlayer} style={{ color: '#4ade80' }}>{player}</span>
            <span className={styles.lbPage} style={{ color: '#4ade80' }}>PAGE {page}</span>
            <span className={styles.lbBonus}>{bonus}</span>
          </div>
        ))}
      </div>

      {/* ── Top-right: Wallet + Resources ── */}
      <div className={styles.rightPanel}>
        <div className={`${styles.panel} ${styles.wallet}`} style={{ padding: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <ConnectButton label="CONNECT WALLET" showBalance={true} />
        </div>

        <div className={`${styles.panel} ${styles.resources}`}>
          <div className={styles.panelTitle}>RESOURCES</div>
          {resources.map(({ label, value, color }) => (
            <div key={label} className={styles.resRow}>
              <span className={styles.resDot} style={{ background: color }} />
              <span className={styles.resLabel}>{label}</span>
              <span className={styles.resValue} style={{ color }}>{value.toLocaleString('en-US')}</span>
            </div>
          ))}
        </div>

        {selectedNode && (
          <div className={`${styles.panel} ${styles.resources}`} style={{ marginTop: '16px' }}>
            <div className={styles.panelTitle}>NODE {selectedNode.id}</div>
            
            {/* ── Sahipsiz veya Boş Node ── */}
            {selectedNode.owner === null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                <div style={{ color: '#00e5ff', fontSize: '14px', marginBottom: '8px', fontFamily: 'Orbitron, sans-serif' }}>
                  Status: UNCLAIMED
                </div>

                {!address ? (
                  <div style={{ color: '#ef4444', fontSize: '10px', fontFamily: 'monospace' }}>
                    Önce cüzdanını bağla!
                  </div>
                ) : !isInitialized ? (
                  <>
                    <div style={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace', marginBottom: '4px' }}>
                      Oyuna başla! Bu node'a Mainframe kurulacak. (500 DATA harcanır, 500 DATA kalır)
                    </div>
                    <button
                      className={styles.cmdBtn}
                      disabled={isTxPending || isTxConfirming}
                      style={{
                        borderColor: '#fbbf24',
                        color: '#fbbf24',
                        textShadow: '0 0 8px rgba(251,191,36,0.6)',
                        opacity: (isTxPending || isTxConfirming) ? 0.5 : 1,
                      }}
                      onClick={() => initPlayer(selectedNode.id)}
                    >
                      {isTxPending ? '⏳ ONAY BEKLENİYOR...' : isTxConfirming ? '⛓ İŞLENİYOR...' : '⬡ OYUNU BAŞLAT — MAINFRAME KUR'}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace', marginBottom: '4px' }}>
                      Bu node boş. Bina kur veya sahiplen!
                    </div>
                    <button
                      className={styles.cmdBtn}
                      disabled={isTxPending || isTxConfirming}
                      style={{
                        borderColor: '#4ade80',
                        color: '#4ade80',
                        opacity: (isTxPending || isTxConfirming) ? 0.5 : 1,
                      }}
                      onClick={() => buildOnNode(selectedNode.id, 1)}
                    >
                      {isTxPending ? '⏳...' : `BUILD MINER (${COST_MINER} DATA)`}
                    </button>
                    <button
                      className={styles.cmdBtn}
                      disabled={isTxPending || isTxConfirming}
                      style={{
                        borderColor: '#38bdf8',
                        color: '#38bdf8',
                        opacity: (isTxPending || isTxConfirming) ? 0.5 : 1,
                      }}
                      onClick={() => buildOnNode(selectedNode.id, 2)}
                    >
                      {isTxPending ? '⏳...' : `BUILD FIREWALL (${COST_FIREWALL} DATA)`}
                    </button>
                    <button
                      className={styles.cmdBtn}
                      disabled={isTxPending || isTxConfirming}
                      style={{
                        borderColor: '#a855f7',
                        color: '#a855f7',
                        opacity: (isTxPending || isTxConfirming) ? 0.5 : 1,
                      }}
                      onClick={() => buildOnNode(selectedNode.id, 3)}
                    >
                      {isTxPending ? '⏳...' : `BUILD DATACENTER (${COST_DATACENTER} DATA)`}
                    </button>
                  </>
                )}
              </div>

            ) : isMyNode && selectedNode.buildingType === 0 ? (
              /* ── Bana ait ama bina yok → İnşa et ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                <div style={{ color: '#39ff14', fontSize: '14px', marginBottom: '4px', fontFamily: 'Orbitron, sans-serif' }}>
                  Status: OWNED — NO BUILDING
                </div>
                <div style={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace', marginBottom: '4px' }}>
                  Owner: {selectedNode.username || 'You'}
                </div>
                {!isInitialized ? (
                  <div style={{ color: '#fbbf24', fontSize: '11px', fontFamily: 'monospace' }}>
                    Önce oyunu başlat! Boş bir node&apos;a tıklayıp &quot;OYUNU BAŞLAT&quot; butonuna bas.
                  </div>
                ) : (
                  <>
                    <button
                      className={styles.cmdBtn}
                      disabled={isTxPending || isTxConfirming}
                      style={{ borderColor: '#4ade80', color: '#4ade80', opacity: (isTxPending || isTxConfirming) ? 0.5 : 1 }}
                      onClick={() => buildOnNode(selectedNode.id, 1)}
                    >
                      {isTxPending ? '⏳...' : `BUILD MINER (${COST_MINER} DATA)`}
                    </button>
                    <button
                      className={styles.cmdBtn}
                      disabled={isTxPending || isTxConfirming}
                      style={{ borderColor: '#38bdf8', color: '#38bdf8', opacity: (isTxPending || isTxConfirming) ? 0.5 : 1 }}
                      onClick={() => buildOnNode(selectedNode.id, 2)}
                    >
                      {isTxPending ? '⏳...' : `BUILD FIREWALL (${COST_FIREWALL} DATA)`}
                    </button>
                    <button
                      className={styles.cmdBtn}
                      disabled={isTxPending || isTxConfirming}
                      style={{ borderColor: '#a855f7', color: '#a855f7', opacity: (isTxPending || isTxConfirming) ? 0.5 : 1 }}
                      onClick={() => buildOnNode(selectedNode.id, 3)}
                    >
                      {isTxPending ? '⏳...' : `BUILD DATACENTER (${COST_DATACENTER} DATA)`}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>

                {/* Ortak bilgiler */}
                <div style={{ color: '#00e5ff', fontSize: '14px', fontFamily: 'Orbitron, sans-serif' }}>
                  Type: {['Empty', 'Miner', 'Firewall', 'DataCenter', 'Mainframe'][selectedNode.buildingType]}
                </div>
                <div style={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}>Level: {selectedNode.level}</div>
                <div style={{ color: '#fbbf24', fontSize: '12px', fontFamily: 'monospace' }}>
                  Owner: {selectedNode.username || selectedNode.owner || 'Unknown'}
                </div>

                {/* ── Miner Paneli ── */}
                {selectedNode.buildingType === 1 && isMyNode && (
                  <>
                    <div style={{ color: '#4ade80', fontSize: '14px', marginTop: '8px', fontWeight: 'bold' }}>
                      Stored Resources: {selectedNode.uncollectedData} DATA
                    </div>
                    <button
                      className={styles.cmdBtn}
                      style={{ marginTop: '8px' }}
                      disabled={isTxPending || isTxConfirming}
                      onClick={() => extractResources(subnetId)}
                    >
                      {isTxPending ? '⏳ ONAY...' : isTxConfirming ? '⛓ İŞLENİYOR...' : `◈ MASS EXTRACT (PAGE ${subnetId + 1})`}
                    </button>
                    {selectedNode.level < 10 && (
                      <button
                        className={styles.cmdBtn}
                        style={{ marginTop: '4px', borderColor: '#38bdf8', color: '#38bdf8' }}
                        disabled={isTxPending || isTxConfirming}
                        onClick={() => upgradeNode(selectedNode.id)}
                      >
                        {isTxPending ? '⏳ ONAY...' : `⬆ UPGRADE (Lv.${selectedNode.level} → ${selectedNode.level + 1})`}
                      </button>
                    )}
                  </>
                )}

                {/* ── DataCenter Paneli ── */}
                {selectedNode.buildingType === 3 && (
                  <>
                    <div style={{ borderTop: '1px solid #1e3a4a', margin: '8px 0' }} />

                    {/* Toplam Data */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace' }}>TOTAL DATA</span>
                      <span style={{ color: '#4ade80', fontSize: '16px', fontWeight: 'bold', fontFamily: 'Orbitron, sans-serif' }}>
                        {globalResources.toLocaleString('en-US')}
                      </span>
                    </div>

                    {/* Son İşlemler */}
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace', marginBottom: '6px', letterSpacing: '1px' }}>
                        RECENT TRANSACTIONS
                      </div>
                      {recentLogs.length === 0 ? (
                        <div style={{ color: '#475569', fontSize: '11px', fontFamily: 'monospace', fontStyle: 'italic' }}>
                          No recent activity
                        </div>
                      ) : (
                        recentLogs.map(log => (
                          <div key={log.id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '4px 6px',
                            marginBottom: '3px',
                            background: 'rgba(74, 222, 128, 0.05)',
                            border: '1px solid rgba(74, 222, 128, 0.15)',
                            borderRadius: '4px',
                          }}>
                            <span style={{ color: '#475569', fontSize: '10px', fontFamily: 'monospace' }}>
                              {formatTime(log.timestamp)}
                            </span>
                            <span style={{ color: '#4ade80', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                              +{log.amount} DATA
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}

                {/* ── Mainframe Paneli ── */}
                {selectedNode.buildingType === 4 && (
                  <>
                    <div style={{ borderTop: '1px solid #1e3a4a', margin: '8px 0' }} />

                    {/* Subnet ID */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace' }}>SUBNET ID</span>
                      <span style={{ color: '#38bdf8', fontSize: '13px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>
                        #PAGE-{subnetId + 1}
                      </span>
                    </div>

                    {/* Güvenlik Yüzdesi */}
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace' }}>
                          SECURITY INDEX
                          <span style={{ color: '#475569', marginLeft: '6px' }}>({firewallCount} FW)</span>
                        </span>
                        <span style={{
                          color: securityPct >= 70 ? '#4ade80' : securityPct >= 40 ? '#fbbf24' : '#ef4444',
                          fontSize: '13px', fontWeight: 'bold', fontFamily: 'Orbitron, monospace'
                        }}>
                          %{securityPct}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ background: '#0f1a26', borderRadius: '4px', height: '8px', overflow: 'hidden', border: '1px solid #1e3a4a' }}>
                        <div style={{
                          height: '100%',
                          width: `${securityPct}%`,
                          background: securityPct >= 70
                            ? 'linear-gradient(90deg, #16a34a, #4ade80)'
                            : securityPct >= 40
                            ? 'linear-gradient(90deg, #d97706, #fbbf24)'
                            : 'linear-gradient(90deg, #b91c1c, #ef4444)',
                          borderRadius: '4px',
                          transition: 'width 0.4s ease',
                          boxShadow: securityPct >= 70 ? '0 0 8px #4ade80' : securityPct >= 40 ? '0 0 8px #fbbf24' : '0 0 8px #ef4444',
                        }} />
                      </div>

                      <div style={{ color: '#475569', fontSize: '10px', fontFamily: 'monospace', marginTop: '4px' }}>
                        {securityPct === 0 && 'CRITICAL — No Firewall protection'}
                        {securityPct > 0 && securityPct < 40 && 'LOW — Vulnerable to breach attacks'}
                        {securityPct >= 40 && securityPct < 70 && 'MODERATE — Partial protection'}
                        {securityPct >= 70 && securityPct < 100 && 'HIGH — Well defended'}
                        {securityPct === 100 && 'MAX — Fully fortified'}
                      </div>
                    </div>
                  </>
                )}

                {/* Yıkım butonu (sadece bana ait binalarda, Mainframe hariç) */}
                {isMyNode && selectedNode.buildingType !== 4 && (
                  <button
                    className={styles.cmdBtn}
                    style={{ marginTop: '16px', borderColor: '#ef4444', color: '#ef4444' }}
                    onClick={() => {
                      // Hemen silme, GSAP çöküş animasyonunu tetikle
                      window.dispatchEvent(
                        new CustomEvent('cyber-collapse', {
                          detail: {
                            nodeId: selectedNode.id,
                            onComplete: () => destroyNode(selectedNode.id),
                          },
                        })
                      );
                    }}
                  >
                    DEMOLISH
                  </button>
                )}

                {/* Hack butonu — düşman Firewall'a: destroyFirewall, diğer düşman node'lara: hack */}
                {isEnemyBuilding && selectedNode.buildingType === 2 && (
                  <button
                    className={styles.cmdBtn}
                    disabled={isTxPending || isTxConfirming}
                    style={{
                      marginTop: '16px',
                      borderColor: '#ef4444',
                      color: '#ef4444',
                      textShadow: '0 0 8px rgba(239,68,68,0.6)',
                      opacity: (isTxPending || isTxConfirming) ? 0.5 : 1,
                    }}
                    onClick={() => setIsHackOpen(true)}
                  >
                    {isTxPending ? '⏳ ONAY...' : '◈ DESTROY FIREWALL'}
                  </button>
                )}
                {isEnemyBuilding && selectedNode.buildingType !== 2 && selectedNode.buildingType !== 4 && (
                  <button
                    className={styles.cmdBtn}
                    disabled={isTxPending || isTxConfirming}
                    style={{
                      marginTop: '16px',
                      borderColor: '#a855f7',
                      color: '#a855f7',
                      textShadow: '0 0 8px rgba(168,85,247,0.6)',
                      opacity: (isTxPending || isTxConfirming) ? 0.5 : 1,
                    }}
                    onClick={() => setIsHackOpen(true)}
                  >
                    {isTxPending ? '⏳ ONAY...' : '◈ HACK NODE'}
                  </button>
                )}

                {/* Upgrade butonu (benim binam, level < 10) */}
                {isMyNode && selectedNode.buildingType !== 0 && selectedNode.buildingType !== 1 && selectedNode.level < 10 && (
                  <button
                    className={styles.cmdBtn}
                    style={{ marginTop: '8px', borderColor: '#38bdf8', color: '#38bdf8' }}
                    disabled={isTxPending || isTxConfirming}
                    onClick={() => upgradeNode(selectedNode.id)}
                  >
                    {isTxPending ? '⏳ ONAY...' : `⬆ UPGRADE (Lv.${selectedNode.level} → ${selectedNode.level + 1})`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom-left: Page Overlay Toggle ── */}
      <div className={`${styles.panel} ${styles.overlayToggle}`} id="btn-overlay-toggle">
        PAGE OVERLAY: ON/OFF
      </div>

      {/* ── TX Durum Göstergesi ── */}
      {(isTxPending || isTxConfirming || isTxSuccess || writeError) && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 24px',
          borderRadius: '8px',
          fontFamily: 'Orbitron, monospace',
          fontSize: '13px',
          fontWeight: 'bold',
          zIndex: 9999,
          border: '1px solid',
          borderColor: writeError ? '#ef4444' : isTxSuccess ? '#4ade80' : '#a855f7',
          background: writeError ? 'rgba(239, 68, 68, 0.15)' : isTxSuccess ? 'rgba(74, 222, 128, 0.15)' : 'rgba(168, 85, 247, 0.15)',
          color: writeError ? '#ef4444' : isTxSuccess ? '#4ade80' : '#a855f7',
          backdropFilter: 'blur(8px)',
          textShadow: writeError ? '0 0 8px #ef4444' : isTxSuccess ? '0 0 8px #4ade80' : '0 0 8px #a855f7',
          cursor: writeError || isTxSuccess ? 'pointer' : 'default',
          maxWidth: '500px',
          textAlign: 'center',
        }}
          onClick={() => { if (writeError || isTxSuccess) resetTx(); }}
        >
          {isTxPending && '⏳ MetaMask\'ta işlemi onayla...'}
          {isTxConfirming && '⛓ İşlem blockchain\'de onaylanıyor...'}
          {isTxSuccess && '✅ İşlem başarılı! (kapat)'}
          {writeError && `❌ TX Hatası: ${writeError.message?.slice(0, 80)} (kapat)`}
        </div>
      )}

      {/* ── Hack Terminal Modal ── */}
      <HackTerminalModal
        isOpen={isHackOpen}
        onClose={() => setIsHackOpen(false)}
        difficulty={hackDifficulty}
        onSuccess={() => {
          setIsHackOpen(false);
          if (selectedNode) {
            if (selectedNode.buildingType === 2) {
              // Firewall yıkma (Hack aşama 1)
              destroyFirewall(selectedNode.id);
            } else {
              // Normal hack (savunmasız node ele geçirme)
              hackNode(selectedNode.id);
            }
          }
        }}
      />

    </div>
  );
}

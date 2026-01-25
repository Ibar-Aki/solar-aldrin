/**
 * KY用紙PDFテンプレート
 * @react-pdf/renderer を使用
 */
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import type { SoloKYSession } from '@/types/ky'

// フォント登録（Noto Sans JP）
// 注意: フォントファイルは public/fonts/ に配置する必要があります
Font.register({
    family: 'NotoSansJP',
    src: '/fonts/NotoSansJP-Regular.ttf',
})

// スタイル定義
const styles = StyleSheet.create({
    page: {
        fontFamily: 'NotoSansJP',
        fontSize: 10,
        padding: 30,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
        paddingBottom: 10,
        borderBottom: '2px solid #2563eb',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2563eb',
    },
    dateText: {
        fontSize: 9,
        color: '#666666',
    },
    section: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        backgroundColor: '#e0e7ff',
        padding: '5 8',
        marginBottom: 5,
        color: '#1e40af',
    },
    basicInfo: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 15,
        marginBottom: 10,
    },
    infoItem: {
        flexDirection: 'row',
        gap: 5,
    },
    label: {
        fontWeight: 'bold',
        color: '#374151',
    },
    value: {
        color: '#111827',
    },
    environmentRisk: {
        backgroundColor: '#fef3c7',
        padding: 8,
        borderLeft: '3px solid #f59e0b',
        marginBottom: 10,
    },
    workItemContainer: {
        marginBottom: 15,
        border: '1px solid #e5e7eb',
        borderRadius: 4,
    },
    workItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#f3f4f6',
        padding: '6 10',
        borderBottom: '1px solid #e5e7eb',
    },
    workItemNumber: {
        fontWeight: 'bold',
        color: '#374151',
    },
    riskBadge: {
        padding: '2 8',
        borderRadius: 10,
        fontSize: 9,
        fontWeight: 'bold',
    },
    riskHigh: {
        backgroundColor: '#fee2e2',
        color: '#dc2626',
    },
    riskMedium: {
        backgroundColor: '#fef3c7',
        color: '#d97706',
    },
    riskLow: {
        backgroundColor: '#d1fae5',
        color: '#059669',
    },
    workItemBody: {
        padding: 10,
    },
    subSection: {
        marginBottom: 8,
    },
    subTitle: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#6b7280',
        marginBottom: 3,
    },
    listItem: {
        flexDirection: 'row',
        marginBottom: 2,
        paddingLeft: 10,
    },
    bullet: {
        marginRight: 5,
        color: '#9ca3af',
    },
    actionGoal: {
        backgroundColor: '#dbeafe',
        padding: 12,
        marginTop: 10,
        borderRadius: 4,
        textAlign: 'center',
    },
    actionGoalLabel: {
        fontSize: 9,
        color: '#1e40af',
        marginBottom: 5,
    },
    actionGoalText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e3a8a',
    },
    confirmSection: {
        marginTop: 15,
        paddingTop: 10,
        borderTop: '1px dashed #d1d5db',
    },
    checkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    checkbox: {
        width: 12,
        height: 12,
        border: '1px solid #9ca3af',
        marginRight: 8,
        textAlign: 'center',
        fontSize: 8,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTop: '1px solid #e5e7eb',
        fontSize: 8,
        color: '#9ca3af',
    },
})

// 危険度に応じたスタイルを取得
const getRiskStyle = (level: number) => {
    if (level >= 4) return styles.riskHigh
    if (level >= 3) return styles.riskMedium
    return styles.riskLow
}

interface KYSheetPDFProps {
    session: SoloKYSession
}

export function KYSheetPDF({ session }: KYSheetPDFProps) {
    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* ヘッダー */}
                <View style={styles.header}>
                    <Text style={styles.title}>一人KY活動記録</Text>
                    <Text style={styles.dateText}>{formatDate(session.createdAt)}</Text>
                </View>

                {/* 基本情報 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>基本情報</Text>
                    <View style={styles.basicInfo}>
                        <View style={styles.infoItem}>
                            <Text style={styles.label}>作業者:</Text>
                            <Text style={styles.value}>{session.userName}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.label}>現場:</Text>
                            <Text style={styles.value}>{session.siteName}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.label}>天候:</Text>
                            <Text style={styles.value}>{session.weather}</Text>
                        </View>
                        {session.temperature !== null && (
                            <View style={styles.infoItem}>
                                <Text style={styles.label}>気温:</Text>
                                <Text style={styles.value}>{session.temperature}℃</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* 環境リスク */}
                {session.environmentRisk && (
                    <View style={styles.environmentRisk}>
                        <Text>⚠️ {session.environmentRisk}</Text>
                    </View>
                )}

                {/* 作業・危険・対策 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>作業と危険予知</Text>
                    {session.workItems.map((item, index) => (
                        <View key={item.id} style={styles.workItemContainer}>
                            <View style={styles.workItemHeader}>
                                <Text style={styles.workItemNumber}>作業{index + 1}</Text>
                                <Text style={[styles.riskBadge, getRiskStyle(item.riskLevel)]}>
                                    危険度: {item.riskLevel}/5
                                </Text>
                            </View>
                            <View style={styles.workItemBody}>
                                {/* 作業内容 */}
                                <View style={styles.subSection}>
                                    <Text style={styles.subTitle}>【作業内容】</Text>
                                    <Text>{item.workDescription}</Text>
                                </View>

                                {/* 危険内容 */}
                                <View style={styles.subSection}>
                                    <Text style={styles.subTitle}>【危険内容】</Text>
                                    <Text>{item.hazardDescription}</Text>
                                </View>

                                {/* なぜ危険か */}
                                <View style={styles.subSection}>
                                    <Text style={styles.subTitle}>【なぜ危険か】</Text>
                                    {item.whyDangerous.map((why, i) => (
                                        <View key={i} style={styles.listItem}>
                                            <Text style={styles.bullet}>•</Text>
                                            <Text>{why}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* 対策 */}
                                <View style={styles.subSection}>
                                    <Text style={styles.subTitle}>【対策】</Text>
                                    {item.countermeasures.map((cm, i) => (
                                        <View key={i} style={styles.listItem}>
                                            <Text style={styles.bullet}>→</Text>
                                            <Text>{cm}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>
                    ))}
                </View>

                {/* 行動目標 */}
                {session.actionGoal && (
                    <View style={styles.actionGoal}>
                        <Text style={styles.actionGoalLabel}>🎯 今日の行動目標</Text>
                        <Text style={styles.actionGoalText}>「{session.actionGoal}」</Text>
                    </View>
                )}

                {/* 確認事項 */}
                <View style={styles.confirmSection}>
                    <View style={styles.checkItem}>
                        <View style={styles.checkbox}>
                            <Text>{session.pointingConfirmed ? '✓' : ''}</Text>
                        </View>
                        <Text>指差し呼称を実施した</Text>
                    </View>
                    <View style={styles.checkItem}>
                        <View style={styles.checkbox}>
                            <Text>{session.allMeasuresImplemented ? '✓' : ''}</Text>
                        </View>
                        <Text>上記の対策をすべて実施する</Text>
                    </View>
                    {session.hadNearMiss && (
                        <View style={{ marginTop: 5 }}>
                            <Text style={{ fontWeight: 'bold' }}>ヒヤリハット: </Text>
                            <Text>{session.nearMissNote || '記録あり'}</Text>
                        </View>
                    )}
                </View>

                {/* フッター */}
                <View style={styles.footer}>
                    <Text>Voice KY Assistant v2</Text>
                    <Text>作成日時: {formatDate(session.completedAt || session.createdAt)}</Text>
                </View>
            </Page>
        </Document>
    )
}

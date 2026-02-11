import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KYBoardCard } from '@/components/KYBoardCard'
import type { WorkItem } from '@/types/ky'

function renderCard(item: Partial<WorkItem>, workItemIndex = 1) {
    return render(<KYBoardCard currentWorkItem={item} workItemIndex={workItemIndex} />)
}

describe('KYBoardCard', () => {
    it('1件目で未入力時は理想的なKYのプレースホルダーを表示する', () => {
        renderCard({})

        expect(screen.getByText('例）脚立上で天井配線を固定する時')).toBeInTheDocument()
        expect(screen.getByText('例）脚立の設置角度が不適切で足元が滑りやすいため')).toBeInTheDocument()
        expect(screen.getByText('例）バランスを崩して墜落し、頭部を負傷する')).toBeInTheDocument()
    })

    it('1件目でも入力済みの欄ではプレースホルダーを表示しない', () => {
        renderCard({
            workDescription: '脚立上で天井配線を固定する',
            hazardDescription: 'バランスを崩して墜落する',
            whyDangerous: ['脚立の設置角度が不適切'],
        })

        expect(screen.queryByText('例）脚立上で天井配線を固定する時')).not.toBeInTheDocument()
        expect(screen.queryByText('例）脚立の設置角度が不適切で足元が滑りやすいため')).not.toBeInTheDocument()
        expect(screen.queryByText('例）バランスを崩して墜落し、頭部を負傷する')).not.toBeInTheDocument()
    })

    it('2件目では未入力でもプレースホルダーを表示しない', () => {
        renderCard({}, 2)

        expect(screen.queryByText('例）脚立上で天井配線を固定する時')).not.toBeInTheDocument()
        expect(screen.queryByText('例）脚立の設置角度が不適切で足元が滑りやすいため')).not.toBeInTheDocument()
        expect(screen.queryByText('例）バランスを崩して墜落し、頭部を負傷する')).not.toBeInTheDocument()
    })

    it('初期表示では想定される危険の4行のみを表示し、対策表は表示しない', () => {
        renderCard({
            workDescription: '足場の上で配管を固定する',
            hazardDescription: 'バランスを崩して転落する',
            whyDangerous: ['足場が狭く足元が不安定なため'],
        })

        expect(screen.getByText('KYボード')).toBeInTheDocument()
        expect(screen.getByText('【1件目】')).toBeInTheDocument()
        expect(screen.getByText('想定される危険')).toBeInTheDocument()
        expect(screen.getByText('何をする時')).toBeInTheDocument()
        expect(screen.queryByText('何をするとき')).not.toBeInTheDocument()
        expect(screen.queryByText('危険への対策（対策は2件以上が必要です）')).not.toBeInTheDocument()
    })

    it('危険情報4項目が揃うと対策表を表示し、配置・行動ラベルを使う', () => {
        renderCard({
            workDescription: '溶接をする',
            hazardDescription: '火花で可燃物が燃える',
            riskLevel: 5,
            whyDangerous: ['周囲に可燃物があるため'],
            countermeasures: [
                { category: 'equipment', text: '可燃物を移動する' },
                { category: 'behavior', text: '火気監視を配置する' },
                { category: 'ppe', text: '防炎手袋を着用する' },
            ],
        })

        expect(screen.getByText('危険への対策（対策は2件以上が必要です）')).toBeInTheDocument()
        expect(screen.getByText('設備・環境')).toBeInTheDocument()
        expect(screen.getByText('配置・行動')).toBeInTheDocument()
        expect(screen.getByText('保護具')).toBeInTheDocument()
        expect(screen.getByText('危険度: 5')).toBeInTheDocument()
    })
})

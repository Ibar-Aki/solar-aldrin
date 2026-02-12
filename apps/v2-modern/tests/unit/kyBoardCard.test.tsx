import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KYBoardCard } from '@/components/KYBoardCard'
import type { WorkItem } from '@/types/ky'

function renderCard(item: Partial<WorkItem>, workItemIndex = 1, boardScale: 'expanded' | 'compact' = 'expanded') {
    return render(
        <KYBoardCard
            currentWorkItem={item}
            workItemIndex={workItemIndex}
            boardScale={boardScale}
            onBoardScaleChange={() => undefined}
        />
    )
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

    it('未入力時は具体性/詳細度バーを灰色の未評価表示にする', () => {
        renderCard({})

        expect(screen.getByTestId('segment-work-description-label')).toHaveTextContent('未')
        expect(screen.getByTestId('segment-work-description-bar')).toHaveClass('bg-slate-300')
        expect(screen.getByTestId('segment-why-dangerous-label')).toHaveTextContent('未')
        expect(screen.getByTestId('segment-why-dangerous-bar')).toHaveClass('bg-slate-300')
    })

    it('具体性バーは何をする時の文字数で小中大に変化する', () => {
        const { rerender } = render(
            <KYBoardCard
                currentWorkItem={{ workDescription: '12345' }}
                workItemIndex={1}
                boardScale="expanded"
                onBoardScaleChange={() => undefined}
            />
        )

        expect(screen.getByTestId('segment-work-description-label')).toHaveTextContent('小')
        expect(screen.getByTestId('segment-work-description-bar')).toHaveClass('bg-red-500')
        expect(screen.getByTestId('segment-work-description-bar')).toHaveClass('w-6')

        rerender(
            <KYBoardCard
                currentWorkItem={{ workDescription: '123456' }}
                workItemIndex={1}
                boardScale="expanded"
                onBoardScaleChange={() => undefined}
            />
        )
        expect(screen.getByTestId('segment-work-description-label')).toHaveTextContent('中')
        expect(screen.getByTestId('segment-work-description-bar')).toHaveClass('bg-amber-500')
        expect(screen.getByTestId('segment-work-description-bar')).toHaveClass('w-10')

        rerender(
            <KYBoardCard
                currentWorkItem={{ workDescription: '1234567890' }}
                workItemIndex={1}
                boardScale="expanded"
                onBoardScaleChange={() => undefined}
            />
        )
        expect(screen.getByTestId('segment-work-description-label')).toHaveTextContent('大')
        expect(screen.getByTestId('segment-work-description-bar')).toHaveClass('bg-emerald-500')
        expect(screen.getByTestId('segment-work-description-bar')).toHaveClass('w-14')
    })

    it('詳細度バーは何が原因での文字数で小中大に変化する', () => {
        const { rerender } = render(
            <KYBoardCard
                currentWorkItem={{ whyDangerous: ['12345'] }}
                workItemIndex={1}
                boardScale="expanded"
                onBoardScaleChange={() => undefined}
            />
        )

        expect(screen.getByTestId('segment-why-dangerous-label')).toHaveTextContent('小')
        expect(screen.getByTestId('segment-why-dangerous-bar')).toHaveClass('bg-red-500')
        expect(screen.getByTestId('segment-why-dangerous-bar')).toHaveClass('w-6')

        rerender(
            <KYBoardCard
                currentWorkItem={{ whyDangerous: ['123456'] }}
                workItemIndex={1}
                boardScale="expanded"
                onBoardScaleChange={() => undefined}
            />
        )
        expect(screen.getByTestId('segment-why-dangerous-label')).toHaveTextContent('中')
        expect(screen.getByTestId('segment-why-dangerous-bar')).toHaveClass('bg-amber-500')
        expect(screen.getByTestId('segment-why-dangerous-bar')).toHaveClass('w-10')

        rerender(
            <KYBoardCard
                currentWorkItem={{ whyDangerous: ['1234567890'] }}
                workItemIndex={1}
                boardScale="expanded"
                onBoardScaleChange={() => undefined}
            />
        )
        expect(screen.getByTestId('segment-why-dangerous-label')).toHaveTextContent('大')
        expect(screen.getByTestId('segment-why-dangerous-bar')).toHaveClass('bg-emerald-500')
        expect(screen.getByTestId('segment-why-dangerous-bar')).toHaveClass('w-14')
    })

    it('未入力時のバー長は短縮した未評価サイズを使う', () => {
        renderCard({})

        expect(screen.getByTestId('segment-work-description-bar')).toHaveClass('w-8')
        expect(screen.getByTestId('segment-why-dangerous-bar')).toHaveClass('w-8')
    })

    it('セグメントバーとチェックを左列に表示する', () => {
        renderCard({
            workDescription: '脚立作業',
            whyDangerous: ['足元が滑る'],
            hazardDescription: '転落する',
        })

        const workLabelCell = screen.getByText('何をする時').parentElement
        const whyLabelCell = screen.getByText('何が原因で').parentElement
        const hazardLabelCell = screen.getByText('どうなる').parentElement

        expect(workLabelCell).toContainElement(screen.getByTestId('segment-work-description'))
        expect(whyLabelCell).toContainElement(screen.getByTestId('segment-why-dangerous'))
        expect(hazardLabelCell).toContainElement(screen.getByTestId('segment-hazard-description-check'))
    })

    it('小中大のラベルをバーの左側に表示する', () => {
        renderCard({
            workDescription: '1234567890',
            whyDangerous: ['1234567890'],
        })

        const workLabel = screen.getByTestId('segment-work-description-label')
        const workBar = screen.getByTestId('segment-work-description-bar')
        expect(workLabel.parentElement?.firstElementChild).toBe(workLabel)
        expect(workLabel.parentElement?.lastElementChild).toBe(workBar)
        expect(workLabel.parentElement).toHaveClass('mt-px')

        const whyLabel = screen.getByTestId('segment-why-dangerous-label')
        const whyBar = screen.getByTestId('segment-why-dangerous-bar')
        expect(whyLabel.parentElement?.firstElementChild).toBe(whyLabel)
        expect(whyLabel.parentElement?.lastElementChild).toBe(whyBar)
        expect(whyLabel.parentElement).toHaveClass('mt-px')
    })

    it('どうなるに入力がある時のみ右下に丸付きチェックを表示する', () => {
        const { rerender } = render(
            <KYBoardCard
                currentWorkItem={{ hazardDescription: '転落する' }}
                workItemIndex={1}
                boardScale="expanded"
                onBoardScaleChange={() => undefined}
            />
        )
        expect(screen.getByTestId('segment-hazard-description-check')).toBeInTheDocument()

        rerender(
            <KYBoardCard
                currentWorkItem={{ hazardDescription: '' }}
                workItemIndex={1}
                boardScale="expanded"
                onBoardScaleChange={() => undefined}
            />
        )
        expect(screen.queryByTestId('segment-hazard-description-check')).not.toBeInTheDocument()
    })

    it('サイズ指定に応じてdata-scale属性を切り替える', () => {
        const { rerender } = renderCard({}, 1, 'expanded')
        expect(screen.getByTestId('ky-board-card')).toHaveAttribute('data-scale', 'expanded')

        rerender(
            <KYBoardCard
                currentWorkItem={{}}
                workItemIndex={1}
                boardScale="compact"
                onBoardScaleChange={() => undefined}
            />
        )
        expect(screen.getByTestId('ky-board-card')).toHaveAttribute('data-scale', 'compact')
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

// src/component/pages/Vet/VetHome.tsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '@/styles/main.css'
import OwnerTreatmentSimpleCard from '@/component/card/OwnerTreatmentSimpleCard'
import TreatmentSlideList from '@/component/card/TreatmentSlideList'

// ✅ 시간 유틸
import { toTimeRange, toLocalHHmm } from '@/utils/timeMapping'

// ✅ 매핑 유틸
import { speciesMapping } from '@/utils/speciesMapping'
import { genderMapping } from '@/utils/genderMapping'
import { subjectMapping } from '@/utils/subjectMapping'

// ✅ API
import { getVetMy } from '@/services/api/Vet/vetmypage'
import { getVetTreatmentList } from '@/services/api/Vet/vettreatment'
import type { VetTreatmentListResponse } from '@/types/Vet/vettreatmentType'
import type { VetMyResponse } from '@/types/Vet/vetmypageType'

// ✅ 상세 모달 관련 (비대면 진료 페이지와 동일)
import VetReservationDetailModal from '@/component/pages/Vet/Treatment/VetReservationDetailModal'
import { getVetReservationDetail } from '@/services/api/Vet/vetreservation'
import { getStaffReservationDetail } from '@/services/api/Staff/staffreservation'
import type { StaffReservationItem } from '@/types/Staff/staffreservationType'

export default function VetHome() {
  const navigate = useNavigate()

  const [me, setMe] = useState<VetMyResponse | null>(null)
  const [loadingMe, setLoadingMe] = useState(true)

  // 모달 상태
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalDetail, setModalDetail] = useState<StaffReservationItem | null>(null)

  const CARD_WIDTH = 180

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await getVetMy()
        if (!alive) return
        setMe(res)
      } catch (e) {
        console.warn('[VetHome] getVetMy failed', e)
      } finally {
        if (alive) setLoadingMe(false)
      }
    })()
    return () => { alive = false }
  }, [])

  type CardRow = {
    id: number
    time: string
    department: string
    petName: string
    petInfo: string
  }

  const [reservationCards, setReservationCards] = useState<CardRow[]>([])
  const [loadingList, setLoadingList] = useState(true)

  // 🔸 HH:mm → 분
  const hhmmToMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number)
    return (Number.isFinite(h) && Number.isFinite(m)) ? h * 60 + m : Number.POSITIVE_INFINITY
  }

  // 🔸 다양한 형태의 startTime/slot을 “시각(분)”으로 환산 (날짜 무시, 시간만)
  const getStartMinutes = (it: VetTreatmentListResponse): number => {
    const s: any = (it as any).startTime ?? (it as any).start_time

    // 1) 숫자면: 슬롯(0~47) 또는 타임스탬프
    if (typeof s === 'number') {
      if (s >= 0 && s <= 47) return s * 30
      const d = new Date(s)
      if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes()
    }

    // 2) 문자열이면: toLocalHHmm으로 HH:mm 뽑아서 분
    if (typeof s === 'string' && s.trim()) {
      const hhmm = toLocalHHmm(s)
      if (hhmm) return hhmmToMinutes(hhmm)
    }

    // 3) 대체: 예약 슬롯(0~47) 또는 HH:mm 문자열
    const slot: any = (it as any).reservationTime ?? (it as any).reservation_time
    if (typeof slot === 'number' && slot >= 0 && slot <= 47) return slot * 30
    if (typeof slot === 'string' && /^\d+$/.test(slot)) return Number(slot) * 30
    if (typeof slot === 'string') {
      const m = slot.match(/^(\d{2}):(\d{2})$/)
      if (m) return hhmmToMinutes(slot)
    }

    // 4) 마지막 안전망
    return Number.POSITIVE_INFINITY
  }
  // 슬롯 인덱스 안전 파서 (숫자/문자 모두)
const toSlotIndex = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v ?? '')
  if (/^\d+$/.test(s)) return Number(s)
  return null
}

  useEffect(() => {
  let alive = true
  ;(async () => {
    try {
      setLoadingList(true)
      const list = await getVetTreatmentList() // type=0 목록
      if (!alive) return

      const src = (list as VetTreatmentListResponse[]) || []

      // ✅ startTime 없는 애들만(= 미시작) + 미완료만
      const onlyPending = src.filter((it: any) => {
        const slot = toSlotIndex(it.startTime)
        const started = slot != null && slot > 0   // 0 또는 null/undefined → 미시작으로 간주
        const completed = it.isCompleted === true
        return !started && !completed
      })

      // 기존과 동일: “시작 시각(분)” 기준 오름차순 정렬
      const sorted = [...onlyPending].sort(
        (a, b) => getStartMinutes(a) - getStartMinutes(b)
      )

      const rows = sorted.map((it) => {
        const pet = it.petInfo
        const species = speciesMapping[pet.species as keyof typeof speciesMapping] ?? '반려동물'
        const gender  = genderMapping[pet.gender as keyof typeof genderMapping] ?? '성별미상'
        const agePart = Number.isFinite(pet.age as number) ? `${pet.age}세` : ''
        const department = subjectMapping[it.subject as keyof typeof subjectMapping] ?? '진료'
        const time = toTimeRange(it.startTime, it.endTime) || ''

        return {
          id: it.reservationId,
          time,
          department,
          petName: pet.name,
          petInfo: [species, gender, agePart].filter(Boolean).join(' / '),
        } as CardRow
      })

      setReservationCards(rows)
    } catch (e) {
      console.warn('[VetHome] getVetTreatmentList failed:', e)
      setReservationCards([])
    } finally {
      if (alive) setLoadingList(false)
    }
  })()
  return () => { alive = false }
}, [])


  // ✅ 카드 클릭 → 상세 모달 (비대면 진료 페이지와 동일 로직)
  const openDetailModal = async (reservationId: number) => {
    setModalOpen(true)
    setModalLoading(true)
    setModalDetail(null)
    try {
      let res: StaffReservationItem | null = null
      try {
        res = await getVetReservationDetail(reservationId)
      } catch {
        res = await getStaffReservationDetail(reservationId)
      }
      setModalDetail(res ?? null)
    } catch {
      setModalDetail(null)
    } finally {
      setModalLoading(false)
    }
  }

  return (
    <div>
      <h3 className="h3 mx-7 pt-13">
        {loadingMe ? '수의사님 반갑습니다!' : `${me?.name ?? ''} 수의사님 반갑습니다!`}
      </h3>

      <h3 className="h3 mx-7 mb-2">어플 사용이 처음이신가요?</h3>
      <button
        onClick={() => navigate('/vet/home/guide')}
        className="h5 mx-7 px-5 py-1 rounded-full inline-block 
        bg-green-300 text-green-100 hover:bg-green-200 transition"
      >
        비대면 진료 가이드
      </button>

      <h3 className="mx-7 h3 mt-11">비대면 진료 예정 목록</h3>
      <div className="overflow-x-auto overflow-visible snap-x snap-mandatory scroll-smooth hide-scrollbar mx-7 pt-3 pb-6">
        <div className="w-max flex gap-4 h-full p-3">
          {loadingList ? (
            <>
              <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" style={{ width: CARD_WIDTH }} />
              <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" style={{ width: CARD_WIDTH }} />
            </>
          ) : (
            reservationCards.map((r) => (
              <div
                key={r.id}
                className="cursor-pointer"
                style={{ minWidth: CARD_WIDTH }}
                onClick={() => openDetailModal(r.id)} // ← ✅ 모달 오픈
              >
                <OwnerTreatmentSimpleCard
                  time={r.time}
                  department={r.department}
                  petName={r.petName}
                  petInfo={r.petInfo}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <h3 className="mx-7 h3">진료 기록 검토</h3>
      <div className="mx-7">
        <TreatmentSlideList onCardClick={(id) => navigate(`/vet/records/detail/${id}`)} />
      </div>

      {/* ✅ 상세 모달 */}
      {modalOpen && (
        <VetReservationDetailModal
          onClose={() => setModalOpen(false)}
          detail={modalDetail}
          loading={modalLoading}
        />
      )}
    </div>
  )
}

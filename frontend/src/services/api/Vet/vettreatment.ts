// src/services/api/Vet/vettreatment.ts
import apiClient from '@/plugins/axios';
import type { VetTreatment, VetTreatmentDetail } from '@/types/Vet/vettreatmentType';

/** 🟢 수의사 진료기록 목록 (GET /treatments/vets/history) */
export const getVetTreatments = async (type: 0 | 1 | 2 = 2): Promise<any[]> => {
  const res = await apiClient.get('/treatments/vets/history', { params: { type } });
  return res.data?.data ?? res.data ?? [];
};

/** 🟢 수의사 진료기록 상세 (GET /treatments/vets/details/{treatment_id}) */
export const getVetTreatmentDetail = async (treatmentId: number): Promise<VetTreatmentDetail> => {
  const res = await apiClient.get(`/treatments/vets/details/${treatmentId}`);
  return res.data?.data ?? res.data;
};

import apiClient from '@/plugins/axios';
import type { VetTreatmentListResponse } from '@/types/Vet/vettreatmentType';

// 비대면 진료 목록 조회
export const getVetTreatmentList = async (): Promise<VetTreatmentListResponse[]> => {
  const res = await apiClient.get('/treatments/vets/history?type=0');
  console.log('res:', res);
  return res.data?.data ?? res.data;
};

import { DashboardContext } from '@/context/Contexts';
import { useContext } from 'react';

// ==============================|| CONFIG - HOOKS ||============================== //

export default function useDashboard() {
    const data = useContext(DashboardContext);
    return data
}

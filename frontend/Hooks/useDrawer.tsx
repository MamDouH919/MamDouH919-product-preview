import { DashboardDrawerContext } from '@/context/Contexts';
import { useContext } from 'react';

export default function useDrawer() {
    return useContext(DashboardDrawerContext);
}

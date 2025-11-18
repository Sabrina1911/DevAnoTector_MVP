import type { Affect } from '../../types';
import RolePanel from './RolePanel';

interface ClinicianRolePanelProps {
  affect: Affect;
  themeObj: any;
  autoRun: boolean;
  isDark: boolean;
  rememberSelection: boolean;
  coilOffsetDeg: number;
  setCoilOffsetDeg: (v: number) => void;
  chargeRateC: number;
  setChargeRateC: (v: number) => void;
  tempC: number;
  setTempC: (v: number) => void;
  load_mA: number;
  setLoad_mA: (v: number) => void;
  handleSelectionChange: (has: boolean) => void;
}

export default function ClinicianRolePanel({
  affect,
  themeObj,
  autoRun,
  isDark,
  rememberSelection,
  coilOffsetDeg,
  setCoilOffsetDeg,
  chargeRateC,
  setChargeRateC,
  tempC,
  setTempC,
  load_mA,
  setLoad_mA,
  handleSelectionChange,
}: ClinicianRolePanelProps) {
  return (
     <RolePanel
          key="clinician"
          title="Clinician View (PHI)"
          role="clinician"
          affect={affect}
          theme={themeObj}
          sliders={{ coilOffsetDeg, chargeRateC, tempC, load_mA }}
          onAdoptBaseline={(b) => {
            setCoilOffsetDeg(b.coilOffsetDeg);
            setChargeRateC(b.chargeRateC);
            setTempC(b.tempC);
            setLoad_mA(b.load_mA);
          }}
          autoRun={autoRun}
          onSelectionChange={(hasSelection: boolean) => {
            // forward RolePanel's boolean selection directly to handler
            handleSelectionChange(hasSelection);
          }}
          highlightActive={affect === "both" || affect === "clinician"}
          isDark={isDark}
          remember={rememberSelection}   // <-- NEW
        />
  );
}
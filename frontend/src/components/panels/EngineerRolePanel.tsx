import type { Affect } from '../../types';
import RolePanel from './RolePanel';

interface EngineerRolePanelProps {
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

export default function EngineerRolePanel({
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
}: EngineerRolePanelProps) {
  return (
      <RolePanel
          key="engineer"
          title="Engineer View (De-Identified)"
          role="engineer"
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
          onSelectionChange={handleSelectionChange}
          highlightActive={affect === "both" || affect === "engineer"}
          isDark={isDark}
          remember={rememberSelection}   // <-- NEW
        />
  );
}
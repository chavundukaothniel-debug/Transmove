package zw.co.transmove.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DevicePermissionsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

package com.york260.focusfishing;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FocusGuardPlugin.class);
        super.onCreate(savedInstanceState);
        FocusService.makeChannels(this);
    }
}

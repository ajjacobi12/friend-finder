// frontend/src/features/chat/useUnreadAnim
import { useEffect, useRef }from 'react';
import { Animated } from 'react-native';

export const useUnreadAnim = (shouldAnimate, isSidebarVisible) => {
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const animationRef = useRef(null);

    useEffect(() => {
        if (shouldAnimate) {
            pulseAnim.setValue(0);
            const intro = Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: false });
            const loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1, duration: 10, useNativeDriver: false }),
                    Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: false }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
                ])
            );
            animationRef.current = Animated.sequence([intro, loop]);
            animationRef.current.start();
        } else {
            if (animationRef.current) {
                animationRef.current.stop();
                animationRef.current = null;
                pulseAnim.setValue(0);
            }
        }
        return () => {
            animationRef.current?.stop();
            pulseAnim.setValue(0);
        }
    }, [shouldAnimate, isSidebarVisible]);

    return pulseAnim;
};
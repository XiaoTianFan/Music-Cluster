// musiccluster/src/components/effects/TiltWrapper.tsx
import React from 'react';
import Tilt from 'react-parallax-tilt';

interface TiltWrapperProps {
  children: React.ReactNode;
  className?: string;
  // Allow any other props Tilt accepts
  [key: string]: any; 
}

const TiltWrapper: React.FC<TiltWrapperProps> = ({ 
  children, 
  className = '', 
  ...props 
}) => (
  <Tilt
    className={className}
    perspective={1000}         // Adjust perspective
    glareEnable={false}         // Optional: add a subtle glare
    glareMaxOpacity={0.15}     // Adjust glare intensity (reduced)
    glareColor="#ffffff"       // Glare color
    glarePosition="all"        // Glare position
    tiltMaxAngleX={-6}          // Max tilt angle (subtler)
    tiltMaxAngleY={-10}
    scale={1.03}               // Slight scale on hover (subtler)
    transitionSpeed={300}
    {...props}                 // Allow overriding props
  >
    {children}
  </Tilt>
);

export default TiltWrapper;
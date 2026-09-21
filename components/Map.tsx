
        const overlay = createCheckpointDetailsModal({
          checkpoint,
          details,
          distanceText,
          mapInstance,
          userLocation,
          onClose: () => undefined,
        });

        overlay.dataset.travelquestCheckpointModal = "true";
        document.body.appendChild(overlay);
      };

      markerElement.addEventListener("click", openDetailsModal);

      return new mapboxgl.Marker({
        element: markerElement,
        anchor: "center",
      })
        .setLngLat([
          checkpoint.longitude,
          checkpoint.latitude,
        ])
        .addTo(mapInstance);
    };

    const renderMode = () => {
      const showCities =
        mapInstance.getZoom() <= CITY_ZOOM_LIMIT;

      const nextMode = showCities
        ? "cities"
        : "checkpoints";
